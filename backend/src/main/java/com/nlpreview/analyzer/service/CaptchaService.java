package com.nlpreview.analyzer.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Service
@Slf4j
public class CaptchaService {

    private static final long MAX_TOKEN_AGE_MS = 5 * 60 * 1000;

    @Value("${app.captcha.enabled:true}")
    private boolean captchaEnabled;

    public boolean verify(String token) {
        if (!captchaEnabled) {
            log.debug("Captcha verification is disabled");
            return true;
        }

        if (token == null || token.isBlank()) {
            log.warn("Captcha token is empty");
            return false;
        }

        try {

            String decoded = new String(Base64.getDecoder().decode(token), StandardCharsets.UTF_8);

            String[] parts = decoded.split("-");

            if (parts.length < 3) {
                log.warn("Invalid captcha token format: insufficient parts");
                return false;
            }

            if (!parts[parts.length - 1].equals("verified")) {
                log.warn("Invalid captcha token: missing verification suffix");
                return false;
            }

            long timestamp;
            try {
                timestamp = Long.parseLong(parts[parts.length - 2]);
            } catch (NumberFormatException e) {
                log.warn("Invalid captcha token: invalid timestamp");
                return false;
            }

            long now = System.currentTimeMillis();
            if (now - timestamp > MAX_TOKEN_AGE_MS) {
                log.warn("Captcha token expired: age={}ms", now - timestamp);
                return false;
            }

            String captchaText = parts[0];
            if (captchaText.length() != 5 || !captchaText.matches("[A-Za-z0-9]+")) {
                log.warn("Invalid captcha text format");
                return false;
            }

            log.info("Captcha verified successfully");
            return true;

        } catch (IllegalArgumentException e) {
            log.warn("Failed to decode captcha token: {}", e.getMessage());
            return false;
        } catch (Exception e) {
            log.error("Error verifying captcha: {}", e.getMessage());
            return false;
        }
    }
}
