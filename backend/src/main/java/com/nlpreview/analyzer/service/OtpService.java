package com.nlpreview.analyzer.service;

import com.nlpreview.analyzer.config.AppProperties;
import com.nlpreview.analyzer.exception.BadRequestException;
import com.nlpreview.analyzer.exception.RateLimitExceededException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;

@Service
@RequiredArgsConstructor
@Slf4j
public class OtpService {

    private static final String OTP_KEY_PREFIX = "otp:";
    private static final String OTP_ATTEMPTS_PREFIX = "otp_attempts:";
    private static final String OTP_COOLDOWN_PREFIX = "otp_cooldown:";
    private static final String OTP_VERIFIED_PREFIX = "otp_verified:";
    private static final String CONTACT_OTP_PREFIX = "contact_otp:";
    private static final String CONTACT_OTP_ATTEMPTS_PREFIX = "contact_otp_attempts:";
    private static final String CONTACT_OTP_COOLDOWN_PREFIX = "contact_otp_cooldown:";
    private static final String CONTACT_OTP_VERIFIED_PREFIX = "contact_otp_verified:";
    private static final String DELETE_ACCOUNT_OTP_PREFIX = "delete_account_otp:";
    private static final String DELETE_ACCOUNT_OTP_ATTEMPTS_PREFIX = "delete_account_otp_attempts:";
    private static final String DELETE_ACCOUNT_OTP_COOLDOWN_PREFIX = "delete_account_otp_cooldown:";
    private static final String DELETE_ACCOUNT_OTP_VERIFIED_PREFIX = "delete_account_otp_verified:";

    private final StringRedisTemplate redisTemplate;
    private final AppProperties appProperties;
    private final EmailService emailService;

    private final SecureRandom secureRandom = new SecureRandom();

    public boolean sendOtp(String email) {
        String normalizedEmail = email.toLowerCase().trim();

        String cooldownKey = OTP_COOLDOWN_PREFIX + normalizedEmail;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            throw new RateLimitExceededException(
                    "Please wait before requesting another OTP. Try again in " +
                            appProperties.getOtp().getCooldownSeconds() + " seconds.");
        }

        String otp = generateOtp();

        String otpKey = OTP_KEY_PREFIX + normalizedEmail;
        redisTemplate.opsForValue().set(otpKey, otp,
                Duration.ofMinutes(appProperties.getOtp().getExpirationMinutes()));

        String attemptsKey = OTP_ATTEMPTS_PREFIX + normalizedEmail;
        redisTemplate.delete(attemptsKey);

        redisTemplate.opsForValue().set(cooldownKey, "1",
                Duration.ofSeconds(appProperties.getOtp().getCooldownSeconds()));

        boolean emailSent;
        try {
            emailSent = emailService.sendOtpEmail(normalizedEmail, otp);
        } catch (Exception e) {
            log.error("Email send failed for {}. Cleaning up OTP keys in Redis.", normalizedEmail);

            redisTemplate.delete(otpKey);
            redisTemplate.delete(cooldownKey);
            throw e;
        }

        if (emailSent) {
            log.info("OTP generated and sent to email: {}", normalizedEmail);
        } else {
            log.info("OTP generated for email: {} (email not delivered - check server logs for the OTP code)", normalizedEmail);
        }

        return emailSent;
    }

    public String sendOtpAndGetCode(String email) {
        String normalizedEmail = email.toLowerCase().trim();

        String cooldownKey = OTP_COOLDOWN_PREFIX + normalizedEmail;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            throw new RateLimitExceededException(
                    "Please wait before requesting another OTP. Try again in " +
                            appProperties.getOtp().getCooldownSeconds() + " seconds.");
        }

        String otp = generateOtp();

        String otpKey = OTP_KEY_PREFIX + normalizedEmail;
        redisTemplate.opsForValue().set(otpKey, otp,
                Duration.ofMinutes(appProperties.getOtp().getExpirationMinutes()));

        String attemptsKey = OTP_ATTEMPTS_PREFIX + normalizedEmail;
        redisTemplate.delete(attemptsKey);

        redisTemplate.opsForValue().set(cooldownKey, "1",
                Duration.ofSeconds(appProperties.getOtp().getCooldownSeconds()));

        boolean emailSent = emailService.sendOtpEmail(normalizedEmail, otp);

        if (!emailSent) {
            log.info("OTP for development: {} (check console)", otp);
            return otp;
        }

        return null;
    }

    public boolean verifyOtp(String email, String otp) {
        String normalizedEmail = email.toLowerCase().trim();

        String attemptsKey = OTP_ATTEMPTS_PREFIX + normalizedEmail;
        String attemptsStr = redisTemplate.opsForValue().get(attemptsKey);
        int attempts = attemptsStr != null ? Integer.parseInt(attemptsStr) : 0;

        if (attempts >= appProperties.getOtp().getMaxAttempts()) {

            redisTemplate.delete(OTP_KEY_PREFIX + normalizedEmail);
            redisTemplate.delete(attemptsKey);
            throw new BadRequestException("Too many failed attempts. Please request a new OTP.");
        }

        String otpKey = OTP_KEY_PREFIX + normalizedEmail;
        String storedOtp = redisTemplate.opsForValue().get(otpKey);

        if (storedOtp == null) {
            throw new BadRequestException("OTP has expired or was not requested. Please request a new OTP.");
        }

        if (!storedOtp.equals(otp.trim())) {

            redisTemplate.opsForValue().set(attemptsKey, String.valueOf(attempts + 1),
                    Duration.ofMinutes(appProperties.getOtp().getExpirationMinutes()));
            throw new BadRequestException("Invalid OTP. " +
                    (appProperties.getOtp().getMaxAttempts() - attempts - 1) + " attempts remaining.");
        }

        redisTemplate.delete(otpKey);
        redisTemplate.delete(attemptsKey);

        String verifiedKey = OTP_VERIFIED_PREFIX + normalizedEmail;
        redisTemplate.opsForValue().set(verifiedKey, "verified", Duration.ofMinutes(15));

        log.info("OTP verified successfully for email: {}", normalizedEmail);
        return true;
    }

    public boolean isEmailVerified(String email) {
        String normalizedEmail = email.toLowerCase().trim();
        String verifiedKey = OTP_VERIFIED_PREFIX + normalizedEmail;
        return Boolean.TRUE.equals(redisTemplate.hasKey(verifiedKey));
    }

    public void consumeVerification(String email) {
        String normalizedEmail = email.toLowerCase().trim();
        redisTemplate.delete(OTP_VERIFIED_PREFIX + normalizedEmail);
    }

    private String generateOtp() {
        int length = appProperties.getOtp().getLength();
        int bound = (int) Math.pow(10, length);
        int code = secureRandom.nextInt(bound);
        return String.format("%0" + length + "d", code);
    }

    public boolean sendContactOtp(String email) {
        String normalizedEmail = email.toLowerCase().trim();

        String cooldownKey = CONTACT_OTP_COOLDOWN_PREFIX + normalizedEmail;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            throw new RateLimitExceededException(
                    "Please wait before requesting another OTP. Try again in " +
                            appProperties.getOtp().getCooldownSeconds() + " seconds.");
        }

        String otp = generateOtp();

        String otpKey = CONTACT_OTP_PREFIX + normalizedEmail;
        redisTemplate.opsForValue().set(otpKey, otp,
                Duration.ofMinutes(appProperties.getOtp().getExpirationMinutes()));

        String attemptsKey = CONTACT_OTP_ATTEMPTS_PREFIX + normalizedEmail;
        redisTemplate.delete(attemptsKey);

        redisTemplate.opsForValue().set(cooldownKey, "1",
                Duration.ofSeconds(appProperties.getOtp().getCooldownSeconds()));

        boolean emailSent = emailService.sendOtpEmail(normalizedEmail, otp);

        if (emailSent) {
            log.info("Contact OTP sent to email: {}", normalizedEmail);
        } else {
            log.info("Contact OTP generated for email: {} (check server logs for the OTP code)", normalizedEmail);
        }

        return emailSent;
    }

    public boolean verifyContactOtp(String email, String otp) {
        String normalizedEmail = email.toLowerCase().trim();

        String attemptsKey = CONTACT_OTP_ATTEMPTS_PREFIX + normalizedEmail;
        String attemptsStr = redisTemplate.opsForValue().get(attemptsKey);
        int attempts = attemptsStr != null ? Integer.parseInt(attemptsStr) : 0;

        if (attempts >= appProperties.getOtp().getMaxAttempts()) {
            redisTemplate.delete(CONTACT_OTP_PREFIX + normalizedEmail);
            redisTemplate.delete(attemptsKey);
            throw new BadRequestException("Too many failed attempts. Please request a new OTP.");
        }

        String otpKey = CONTACT_OTP_PREFIX + normalizedEmail;
        String storedOtp = redisTemplate.opsForValue().get(otpKey);

        if (storedOtp == null) {
            throw new BadRequestException("OTP has expired or was not requested. Please request a new OTP.");
        }

        if (!storedOtp.equals(otp.trim())) {
            redisTemplate.opsForValue().set(attemptsKey, String.valueOf(attempts + 1),
                    Duration.ofMinutes(appProperties.getOtp().getExpirationMinutes()));
            throw new BadRequestException("Invalid OTP. " +
                    (appProperties.getOtp().getMaxAttempts() - attempts - 1) + " attempts remaining.");
        }

        redisTemplate.delete(otpKey);
        redisTemplate.delete(attemptsKey);

        String verifiedKey = CONTACT_OTP_VERIFIED_PREFIX + normalizedEmail;
        redisTemplate.opsForValue().set(verifiedKey, "verified", Duration.ofMinutes(15));

        log.info("Contact OTP verified successfully for email: {}", normalizedEmail);
        return true;
    }

    public boolean isContactEmailVerified(String email) {
        String normalizedEmail = email.toLowerCase().trim();
        String verifiedKey = CONTACT_OTP_VERIFIED_PREFIX + normalizedEmail;
        return Boolean.TRUE.equals(redisTemplate.hasKey(verifiedKey));
    }

    public void consumeContactVerification(String email) {
        String normalizedEmail = email.toLowerCase().trim();
        redisTemplate.delete(CONTACT_OTP_VERIFIED_PREFIX + normalizedEmail);
    }

    public boolean sendDeleteAccountOtp(String email) {
        String normalizedEmail = email.toLowerCase().trim();

        String cooldownKey = DELETE_ACCOUNT_OTP_COOLDOWN_PREFIX + normalizedEmail;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            throw new RateLimitExceededException(
                    "Please wait before requesting another OTP. Try again in " +
                            appProperties.getOtp().getCooldownSeconds() + " seconds.");
        }

        String otp = generateOtp();

        String otpKey = DELETE_ACCOUNT_OTP_PREFIX + normalizedEmail;
        redisTemplate.opsForValue().set(otpKey, otp,
                Duration.ofMinutes(appProperties.getOtp().getExpirationMinutes()));

        String attemptsKey = DELETE_ACCOUNT_OTP_ATTEMPTS_PREFIX + normalizedEmail;
        redisTemplate.delete(attemptsKey);

        redisTemplate.opsForValue().set(cooldownKey, "1",
                Duration.ofSeconds(appProperties.getOtp().getCooldownSeconds()));

        boolean emailSent = emailService.sendDeleteAccountOtpEmail(normalizedEmail, otp);

        if (emailSent) {
            log.info("Delete account OTP sent to email: {}", normalizedEmail);
        } else {
            log.info("Delete account OTP generated for email: {} (check server logs for the OTP code)", normalizedEmail);
        }

        return emailSent;
    }

    public boolean verifyDeleteAccountOtp(String email, String otp) {
        String normalizedEmail = email.toLowerCase().trim();

        String attemptsKey = DELETE_ACCOUNT_OTP_ATTEMPTS_PREFIX + normalizedEmail;
        String attemptsStr = redisTemplate.opsForValue().get(attemptsKey);
        int attempts = attemptsStr != null ? Integer.parseInt(attemptsStr) : 0;

        if (attempts >= appProperties.getOtp().getMaxAttempts()) {
            redisTemplate.delete(DELETE_ACCOUNT_OTP_PREFIX + normalizedEmail);
            redisTemplate.delete(attemptsKey);
            throw new BadRequestException("Too many failed attempts. Please request a new OTP.");
        }

        String otpKey = DELETE_ACCOUNT_OTP_PREFIX + normalizedEmail;
        String storedOtp = redisTemplate.opsForValue().get(otpKey);

        if (storedOtp == null) {
            throw new BadRequestException("OTP has expired or was not requested. Please request a new OTP.");
        }

        if (!storedOtp.equals(otp.trim())) {
            redisTemplate.opsForValue().set(attemptsKey, String.valueOf(attempts + 1),
                    Duration.ofMinutes(appProperties.getOtp().getExpirationMinutes()));
            throw new BadRequestException("Invalid OTP. " +
                    (appProperties.getOtp().getMaxAttempts() - attempts - 1) + " attempts remaining.");
        }

        redisTemplate.delete(otpKey);
        redisTemplate.delete(attemptsKey);

        String verifiedKey = DELETE_ACCOUNT_OTP_VERIFIED_PREFIX + normalizedEmail;
        redisTemplate.opsForValue().set(verifiedKey, "verified", Duration.ofMinutes(5));

        log.info("Delete account OTP verified successfully for email: {}", normalizedEmail);
        return true;
    }

    public boolean isDeleteAccountVerified(String email) {
        String normalizedEmail = email.toLowerCase().trim();
        String verifiedKey = DELETE_ACCOUNT_OTP_VERIFIED_PREFIX + normalizedEmail;
        return Boolean.TRUE.equals(redisTemplate.hasKey(verifiedKey));
    }

    public void consumeDeleteAccountVerification(String email) {
        String normalizedEmail = email.toLowerCase().trim();
        redisTemplate.delete(DELETE_ACCOUNT_OTP_VERIFIED_PREFIX + normalizedEmail);
    }
}
