package com.nlpreview.analyzer.controller;

import com.nlpreview.analyzer.dto.request.LoginRequest;
import com.nlpreview.analyzer.dto.request.RefreshTokenRequest;
import com.nlpreview.analyzer.dto.request.SendOtpRequest;
import com.nlpreview.analyzer.dto.request.SignupRequest;
import com.nlpreview.analyzer.dto.request.VerifyOtpRequest;
import com.nlpreview.analyzer.dto.response.AuthResponse;
import com.nlpreview.analyzer.dto.response.MessageResponse;
import com.nlpreview.analyzer.exception.BadRequestException;
import com.nlpreview.analyzer.security.UserPrincipal;
import com.nlpreview.analyzer.service.AuthService;
import com.nlpreview.analyzer.service.CaptchaService;
import com.nlpreview.analyzer.service.OtpService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;
    private final OtpService otpService;
    private final CaptchaService captchaService;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin-secret}")
    private String adminSecret;

    @PostMapping("/send-otp")
    public ResponseEntity<MessageResponse> sendOtp(@Valid @RequestBody SendOtpRequest request) {
        log.info("OTP request for email: {}", request.getEmail());

        boolean captchaValid = captchaService.verify(request.getCaptchaToken());
        if (!captchaValid) {
            throw new BadRequestException("Captcha verification failed. Please complete the captcha and try again.");
        }

        boolean emailSent = otpService.sendOtp(request.getEmail());

        if (emailSent) {
            return ResponseEntity.ok(MessageResponse.builder()
                    .message("Verification code sent to your email")
                    .build());
        }

        return ResponseEntity.ok(MessageResponse.builder()
                .message("Verification code generated. OTP will be sent to your email shortly.")
                .build());
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<MessageResponse> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        log.info("OTP verification attempt for email: {}", request.getEmail());
        otpService.verifyOtp(request.getEmail(), request.getOtp());
        return ResponseEntity.ok(MessageResponse.builder()
                .message("Email verified successfully")
                .build());
    }

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        log.info("Signup request for email: {}", request.getEmail());
        AuthResponse response = authService.signup(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                              HttpServletRequest httpRequest) {

        boolean captchaValid = captchaService.verify(request.getCaptchaToken());
        if (!captchaValid) {
            throw new BadRequestException("Captcha verification failed. Please complete the captcha and try again.");
        }

        String ipAddress = getClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");

        log.info("Login attempt for email: {} from IP: {}", request.getEmail(), ipAddress);
        AuthResponse response = authService.login(request, ipAddress, userAgent);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<AuthResponse> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refreshToken(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<MessageResponse> logout(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.ok(MessageResponse.builder().message("Not logged in").build());
        }
        log.info("Logout request for user: {}", principal.getEmail());
        MessageResponse response = authService.logout(principal.getId());
        return ResponseEntity.ok(response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }

    @PostMapping("/create-admin")
    public ResponseEntity<MessageResponse> createAdmin(@RequestBody CreateAdminRequest request) {
        if (!adminSecret.equals(request.getSecret())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(MessageResponse.builder().message("Invalid admin secret").build());
        }

        try {
            authService.createAdmin(request.getEmail(), request.getPassword(), request.getFullName());
            log.info("Admin user created: {}", request.getEmail());
            return ResponseEntity.ok(MessageResponse.builder()
                    .message("Admin created successfully")
                    .build());
        } catch (Exception e) {
            log.error("Failed to create admin: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(MessageResponse.builder().message("Failed to create admin: " + e.getMessage()).build());
        }
    }

    @lombok.Data
    public static class CreateAdminRequest {
        private String email;
        private String password;
        private String fullName;
        private String secret;
    }
}
