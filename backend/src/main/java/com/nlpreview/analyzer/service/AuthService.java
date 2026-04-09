package com.nlpreview.analyzer.service;

import com.nlpreview.analyzer.config.AppProperties;
import com.nlpreview.analyzer.dto.request.ChangePasswordRequest;
import com.nlpreview.analyzer.dto.request.LoginRequest;
import com.nlpreview.analyzer.dto.request.RefreshTokenRequest;
import com.nlpreview.analyzer.dto.request.SignupRequest;
import com.nlpreview.analyzer.dto.response.AuthResponse;
import com.nlpreview.analyzer.dto.response.MessageResponse;
import com.nlpreview.analyzer.dto.response.UserProfileResponse;
import com.nlpreview.analyzer.entity.RefreshToken;
import com.nlpreview.analyzer.entity.User;
import com.nlpreview.analyzer.exception.BadRequestException;
import com.nlpreview.analyzer.exception.ResourceNotFoundException;
import com.nlpreview.analyzer.exception.TooManyRequestsException;
import com.nlpreview.analyzer.exception.UnauthorizedException;
import com.nlpreview.analyzer.repository.RefreshTokenRepository;
import com.nlpreview.analyzer.repository.UserRepository;
import com.nlpreview.analyzer.security.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final int MAX_ACTIVE_REFRESH_TOKENS = 5;

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final AppProperties appProperties;
    private final OtpService otpService;
    private final LoginAttemptService loginAttemptService;
    private final EmailService emailService;

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        String email = request.getEmail().toLowerCase().trim();

        if (!otpService.isEmailVerified(email)) {
            throw new BadRequestException("Email has not been verified. Please verify your email with an OTP first.");
        }

        if (userRepository.existsByEmail(email)) {
            throw new BadRequestException("Email is already registered");
        }

        User user = User.builder()
                .email(email)
                .fullName(request.getFullName().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(User.Role.USER)
                .build();

        user = userRepository.save(user);

        otpService.consumeVerification(email);

        log.info("New user registered: {}", user.getEmail());

        emailService.sendWelcomeEmail(user.getEmail(), user.getFullName());

        return generateAuthResponse(user, null, null);
    }

    @Transactional
    public AuthResponse login(LoginRequest request, String ipAddress, String userAgent) {

        if (loginAttemptService.isIpBlocked(ipAddress)) {
            throw new TooManyRequestsException("Too many failed attempts. IP is temporarily blocked. Please try again later.");
        }

        String email = request.getEmail().toLowerCase().trim();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> {
                    loginAttemptService.recordFailedAttempt(ipAddress);
                    return new UnauthorizedException("Invalid email or password");
                });

        if (user.isAccountLocked()) {
            if (user.getLockExpiresAt() != null && user.getLockExpiresAt().isAfter(Instant.now())) {
                throw new UnauthorizedException("Account is temporarily locked. Please try again later.");
            }

            user.setAccountLocked(false);
            user.setFailedLoginAttempts(0);
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.getPassword())
            );

            user.setFailedLoginAttempts(0);
            userRepository.save(user);

            loginAttemptService.recordSuccessfulLogin(ipAddress);

            log.info("Successful login for user: {}", email);
            return generateAuthResponse(user, ipAddress, userAgent);
        } catch (BadCredentialsException e) {

            loginAttemptService.recordFailedAttempt(ipAddress);

            int attempts = user.getFailedLoginAttempts() + 1;
            int maxAttempts = loginAttemptService.getMaxFailedAttemptsPerAccount();
            int remaining = maxAttempts - attempts;

            user.setFailedLoginAttempts(attempts);

            if (remaining <= 0) {
                user.setAccountLocked(true);
                user.setLockExpiresAt(Instant.now().plus(Duration.ofMinutes(loginAttemptService.getAccountLockDurationMinutes())));
                log.warn("Account locked for user: {} after {} failed attempts", user.getEmail(), attempts);
            }

            userRepository.save(user);

            if (remaining > 0) {
                throw new UnauthorizedException("Invalid email or password. " + remaining + " attempt" + (remaining > 1 ? "s" : "") + " remaining before account lock.");
            }
            throw new UnauthorizedException("Account is temporarily locked. Too many failed login attempts.");
        }
    }

    @Transactional
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        String tokenHash = hashToken(request.getRefreshToken());

        RefreshToken refreshToken = refreshTokenRepository.findByTokenHashAndRevokedFalse(tokenHash)
                .orElseThrow(() -> new UnauthorizedException("Invalid or expired refresh token"));

        if (refreshToken.getExpiresAt().isBefore(Instant.now())) {
            refreshToken.setRevoked(true);
            refreshTokenRepository.save(refreshToken);
            throw new UnauthorizedException("Refresh token has expired");
        }

        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);

        User user = refreshToken.getUser();
        log.info("Token refreshed for user: {}", user.getEmail());

        return generateAuthResponse(user, refreshToken.getIssuedFromIp(), refreshToken.getUserAgent());
    }

    @Transactional
    public MessageResponse logout(UUID userId) {
        refreshTokenRepository.revokeAllByUserId(userId);
        log.info("User logged out, all refresh tokens revoked for userId: {}", userId);
        return MessageResponse.builder().message("Successfully logged out").build();
    }

    @Transactional
    public MessageResponse changePassword(UUID userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new BadRequestException("New password must be different from the current password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        refreshTokenRepository.revokeAllByUserId(userId);

        log.info("Password changed for user: {}", user.getEmail());

        emailService.sendPasswordChangedEmail(user.getEmail(), user.getFullName());

        return MessageResponse.builder().message("Password changed successfully").build();
    }

    private AuthResponse generateAuthResponse(User user, String ipAddress, String userAgent) {
        String accessToken = jwtTokenProvider.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole().name()
        );
        String rawRefreshToken = jwtTokenProvider.generateRefreshToken();

        long activeTokens = refreshTokenRepository.countByUserIdAndRevokedFalse(user.getId());
        if (activeTokens >= MAX_ACTIVE_REFRESH_TOKENS) {
            refreshTokenRepository.revokeAllByUserId(user.getId());
        }

        RefreshToken refreshTokenEntity = RefreshToken.builder()
                .tokenHash(hashToken(rawRefreshToken))
                .user(user)
                .expiresAt(Instant.now().plusMillis(jwtTokenProvider.getRefreshTokenExpirationMs()))
                .issuedFromIp(ipAddress)
                .userAgent(userAgent)
                .build();

        refreshTokenRepository.save(refreshTokenEntity);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(rawRefreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getAccessTokenExpirationMs() / 1000)
                .user(UserProfileResponse.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .fullName(user.getFullName())
                        .role(user.getRole().name())
                        .createdAt(user.getCreatedAt())
                        .build())
                .build();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int handleFailedLogin(User user, String ipAddress) {

        loginAttemptService.recordFailedAttempt(ipAddress);

        int attempts = user.getFailedLoginAttempts() + 1;
        int maxAttempts = loginAttemptService.getMaxFailedAttemptsPerAccount();
        int remaining = maxAttempts - attempts;

        user.setFailedLoginAttempts(attempts);

        if (remaining <= 0) {
            user.setAccountLocked(true);
            user.setLockExpiresAt(Instant.now().plus(Duration.ofMinutes(loginAttemptService.getAccountLockDurationMinutes())));
            log.warn("Account locked for user: {} after {} failed attempts", user.getEmail(), attempts);
        }

        userRepository.save(user);
        return remaining;
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    @Transactional
    public User createAdmin(String email, String password, String fullName) {
        String normalizedEmail = email.toLowerCase().trim();

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new BadRequestException("Email already exists");
        }

        User admin = User.builder()
                .email(normalizedEmail)
                .fullName(fullName != null ? fullName.trim() : "Admin")
                .passwordHash(passwordEncoder.encode(password))
                .role(User.Role.ADMIN)
                .enabled(true)
                .accountLocked(false)
                .failedLoginAttempts(0)
                .build();

        admin = userRepository.save(admin);
        log.info("Admin user created: {}", admin.getEmail());
        return admin;
    }
}
