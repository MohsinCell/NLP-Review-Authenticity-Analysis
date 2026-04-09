package com.nlpreview.analyzer.controller;

import com.nlpreview.analyzer.dto.request.ContactMessageRequest;
import com.nlpreview.analyzer.dto.request.SendOtpRequest;
import com.nlpreview.analyzer.dto.request.VerifyContactOtpRequest;
import com.nlpreview.analyzer.dto.response.ContactMessageResponse;
import com.nlpreview.analyzer.dto.response.MessageResponse;
import com.nlpreview.analyzer.exception.BadRequestException;
import com.nlpreview.analyzer.service.CaptchaService;
import com.nlpreview.analyzer.service.ContactMessageService;
import com.nlpreview.analyzer.service.OtpService;
import com.nlpreview.analyzer.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/contact")
@RequiredArgsConstructor
@Slf4j
public class ContactController {

    private final ContactMessageService contactMessageService;
    private final CaptchaService captchaService;
    private final OtpService otpService;

    @PostMapping("/send-otp")
    public ResponseEntity<MessageResponse> sendContactOtp(
            @Valid @RequestBody SendOtpRequest request) {

        boolean emailSent = otpService.sendContactOtp(request.getEmail());
        String message = emailSent
                ? "Verification code sent to your email"
                : "Verification code generated (check server logs)";

        return ResponseEntity.ok(MessageResponse.builder().message(message).build());
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<MessageResponse> verifyContactOtp(
            @Valid @RequestBody VerifyContactOtpRequest request) {

        otpService.verifyContactOtp(request.getEmail(), request.getOtp());
        return ResponseEntity.ok(MessageResponse.builder().message("Email verified successfully").build());
    }

    @PostMapping
    public ResponseEntity<ContactMessageResponse> submitMessage(
            @Valid @RequestBody ContactMessageRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        if (userPrincipal == null) {
            if (!otpService.isContactEmailVerified(request.getEmail())) {
                throw new BadRequestException("Email verification required. Please verify your email first.");
            }
            otpService.consumeContactVerification(request.getEmail());
        }

        UUID userId = userPrincipal != null ? userPrincipal.getId() : null;
        ContactMessageResponse response = contactMessageService.submitMessage(request, userId);

        return ResponseEntity.ok(response);
    }
}
