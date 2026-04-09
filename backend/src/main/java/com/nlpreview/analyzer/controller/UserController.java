package com.nlpreview.analyzer.controller;

import com.nlpreview.analyzer.dto.request.ChangePasswordRequest;
import com.nlpreview.analyzer.dto.request.ConfirmDeleteAccountRequest;
import com.nlpreview.analyzer.dto.request.DeleteAccountRequest;
import com.nlpreview.analyzer.dto.response.MessageResponse;
import com.nlpreview.analyzer.dto.response.PagedResponse;
import com.nlpreview.analyzer.dto.response.ReviewHistoryResponse;
import com.nlpreview.analyzer.dto.response.UserProfileResponse;
import com.nlpreview.analyzer.entity.User;
import com.nlpreview.analyzer.exception.BadRequestException;
import com.nlpreview.analyzer.exception.ResourceNotFoundException;
import com.nlpreview.analyzer.repository.LinkAnalysisRepository;
import com.nlpreview.analyzer.repository.RefreshTokenRepository;
import com.nlpreview.analyzer.repository.ReviewAnalysisRepository;
import com.nlpreview.analyzer.repository.UserRepository;
import com.nlpreview.analyzer.security.UserPrincipal;
import com.nlpreview.analyzer.service.AuthService;
import com.nlpreview.analyzer.service.EmailService;
import com.nlpreview.analyzer.service.HistoryService;
import com.nlpreview.analyzer.service.OtpService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@Slf4j
public class UserController {

    private final HistoryService historyService;
    private final AuthService authService;
    private final OtpService otpService;
    private final EmailService emailService;
    private final UserRepository userRepository;
    private final ReviewAnalysisRepository reviewAnalysisRepository;
    private final LinkAnalysisRepository linkAnalysisRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getCurrentUser(@AuthenticationPrincipal UserPrincipal principal) {
        User user = userRepository.findById(principal.getId()).orElse(null);

        long reviewCount = reviewAnalysisRepository.countByUserId(principal.getId());
        long linkCount = linkAnalysisRepository.countByUserId(principal.getId());

        UserProfileResponse profile = UserProfileResponse.builder()
                .id(principal.getId())
                .email(principal.getEmail())
                .fullName(principal.getFullName())
                .role(principal.getRole().name())
                .createdAt(user != null ? user.getCreatedAt() : null)
                .totalAnalyses(reviewCount + linkCount)
                .build();
        return ResponseEntity.ok(profile);
    }

    @PutMapping("/change-password")
    public ResponseEntity<MessageResponse> changePassword(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request) {
        log.info("Password change request for user: {}", principal.getId());
        MessageResponse response = authService.changePassword(principal.getId(), request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/history")
    public ResponseEntity<PagedResponse<ReviewHistoryResponse>> getUserHistory(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        log.info("History request for user: {}, type: {}, page: {}, size: {}", principal.getId(), type, page, size);

        size = Math.min(Math.max(size, 1), 100);

        PagedResponse<ReviewHistoryResponse> history = historyService.getUserHistory(principal.getId(), type, page, size);
        return ResponseEntity.ok(history);
    }

    @PostMapping("/delete-account/initiate")
    public ResponseEntity<MessageResponse> initiateDeleteAccount(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody DeleteAccountRequest request) {

        log.info("Delete account initiation request for user: {}", principal.getId());

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Incorrect password");
        }

        otpService.sendDeleteAccountOtp(user.getEmail());

        return ResponseEntity.ok(MessageResponse.builder()
                .message("Verification code sent to your email. Please check your inbox.")
                .build());
    }

    @PostMapping("/delete-account/confirm")
    @Transactional
    public ResponseEntity<MessageResponse> confirmDeleteAccount(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ConfirmDeleteAccountRequest request) {

        log.info("Delete account confirmation request for user: {}", principal.getId());

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        otpService.verifyDeleteAccountOtp(user.getEmail(), request.getOtp());

        String userEmail = user.getEmail();
        String userFullName = user.getFullName();

        log.info("Deleting all data for user: {}", principal.getId());

        reviewAnalysisRepository.deleteAllByUserId(principal.getId());
        linkAnalysisRepository.deleteAllByUserId(principal.getId());

        refreshTokenRepository.revokeAllByUserId(principal.getId());

        userRepository.delete(user);

        otpService.consumeDeleteAccountVerification(userEmail);

        log.info("Account deleted successfully for user: {} ({})", principal.getId(), userEmail);

        emailService.sendAccountDeletedEmail(userEmail, userFullName);

        return ResponseEntity.ok(MessageResponse.builder()
                .message("Your account has been permanently deleted.")
                .build());
    }
}
