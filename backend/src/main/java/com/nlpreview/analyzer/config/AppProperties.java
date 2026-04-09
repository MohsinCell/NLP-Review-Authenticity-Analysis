package com.nlpreview.analyzer.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
@ConfigurationProperties(prefix = "app")
@Data
public class AppProperties {

    private Jwt jwt = new Jwt();
    private Encryption encryption = new Encryption();
    private MlService mlService = new MlService();
    private ScraperService scraperService = new ScraperService();
    private RateLimit rateLimit = new RateLimit();
    private Otp otp = new Otp();
    private ResendConfig resend = new ResendConfig();
    private MailConfig mail = new MailConfig();

    @Data
    public static class Jwt {
        private String secret;
        private long accessTokenExpirationMs = 900000;
        private long refreshTokenExpirationMs = 604800000;
    }

    @Data
    public static class Encryption {
        private String secretKey;
        private String algorithm = "AES/GCM/NoPadding";
    }

    @Data
    public static class MlService {
        private String baseUrl = "http://localhost:5001";
        private int timeoutMs = 10000;
        private int retryMaxAttempts = 3;
        private int retryDelayMs = 1000;
    }

    @Data
    public static class ScraperService {
        private String baseUrl = "http://localhost:5000";
        private int timeoutMs = 30000;
        private int pollIntervalMs = 2000;
        private int maxPollAttempts = 60;
        private List<String> allowedDomains = List.of(
                "amazon.in", "amazon.com", "amazon.co.uk",
                "flipkart.com", "myntra.com", "ajio.com",
                "nykaa.com", "nykaafashion.com"
        );
    }

    @Data
    public static class RateLimit {
        private int anonymousRequestsPerMinute = 20;
        private int authenticatedRequestsPerMinute = 60;
    }

    @Data
    public static class Otp {
        private int length = 6;
        private int expirationMinutes = 10;
        private int maxAttempts = 5;
        private int cooldownSeconds = 60;
    }

    @Data
    public static class ResendConfig {
        private String apiKey;
        private String fromEmail = "noreply@reviewiq.website";
        private String adminEmail = "";
    }

    @Data
    public static class MailConfig {
        private String host = "smtp.gmail.com";
        private int port = 587;
        private String username = "";
        private String password = "";
    }
}
