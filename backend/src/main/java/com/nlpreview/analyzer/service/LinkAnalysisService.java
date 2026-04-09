package com.nlpreview.analyzer.service;

import com.nlpreview.analyzer.config.AppProperties;
import com.nlpreview.analyzer.dto.request.LinkAnalysisRequest;
import com.nlpreview.analyzer.dto.request.SaveLinkAnalysisRequest;
import com.nlpreview.analyzer.dto.response.LinkAnalysisResponse;
import com.nlpreview.analyzer.dto.response.MlInferenceResponse;
import com.nlpreview.analyzer.dto.response.ScraperReviewDto;
import com.nlpreview.analyzer.entity.AnalysisMetric;
import com.nlpreview.analyzer.entity.LinkAnalysis;
import com.nlpreview.analyzer.entity.User;
import com.nlpreview.analyzer.exception.BadRequestException;
import com.nlpreview.analyzer.exception.ServiceUnavailableException;
import com.nlpreview.analyzer.integration.MlServiceClient;
import com.nlpreview.analyzer.integration.ScraperServiceClient;
import com.nlpreview.analyzer.repository.AnalysisMetricRepository;
import com.nlpreview.analyzer.repository.LinkAnalysisRepository;
import com.nlpreview.analyzer.repository.UserRepository;
import com.nlpreview.analyzer.security.UserPrincipal;
import com.nlpreview.analyzer.util.EncryptionUtil;
import com.nlpreview.analyzer.util.LanguageDetector;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class LinkAnalysisService {

    private final ScraperServiceClient scraperServiceClient;
    private final MlServiceClient mlServiceClient;
    private final LinkAnalysisRepository linkAnalysisRepository;
    private final UserRepository userRepository;
    private final AnalysisMetricRepository analysisMetricRepository;
    private final EncryptionUtil encryptionUtil;
    private final LanguageDetector languageDetector;
    private final AppProperties appProperties;

    @Transactional
    public LinkAnalysisResponse analyzeProductLink(LinkAnalysisRequest request) {
        String productUrl = request.getProductUrl().trim();
        String domain = extractAndValidateDomain(productUrl);

        log.info("Starting link analysis for domain: {}", domain);

        List<ScraperReviewDto> scrapedReviews = scraperServiceClient.scrapeReviews(productUrl);

        if (scrapedReviews == null || scrapedReviews.isEmpty()) {
            throw new ServiceUnavailableException("No reviews could be scraped from the provided URL");
        }

        log.info("Scraped {} reviews from {}", scrapedReviews.size(), domain);

        int positiveCount = 0;
        int negativeCount = 0;
        int neutralCount = 0;
        double totalPredictedRating = 0;
        double totalAiProbability = 0;
        double totalAuthenticityScore = 0;
        Set<String> languages = new HashSet<>();
        int analyzed = 0;

        for (ScraperReviewDto review : scrapedReviews) {
            if (review.getText() == null || review.getText().trim().isEmpty()) {
                continue;
            }

            try {

                MlInferenceResponse mlResponse = mlServiceClient.analyzeReview(review.getText());

                // Use ML service language detection if available, fallback to regex
                String lang = mlResponse.getDetectedLanguage();
                if (lang == null || lang.isBlank()) {
                    lang = languageDetector.detectLanguage(review.getText());
                }
                if ("hi-en".equalsIgnoreCase(lang) || "hi".equalsIgnoreCase(lang)) {
                    lang = "en";
                }
                languages.add(lang);

                switch (mlResponse.getSentiment().toLowerCase()) {
                    case "positive" -> positiveCount++;
                    case "negative" -> negativeCount++;
                    default -> neutralCount++;
                }

                totalPredictedRating += mlResponse.getRating();
                totalAiProbability += mlResponse.getAiProbability();
                totalAuthenticityScore += computeAuthenticityScore(mlResponse);
                analyzed++;
            } catch (Exception e) {
                log.warn("Failed to analyze scraped review: {}", e.getMessage());
            }
        }

        if (analyzed == 0) {
            throw new ServiceUnavailableException("Failed to analyze any of the scraped reviews");
        }

        LinkAnalysisResponse response = LinkAnalysisResponse.builder()
                .totalReviewsAnalyzed(analyzed)
                .positivePercentage(round((double) positiveCount / analyzed * 100, 1))
                .negativePercentage(round((double) negativeCount / analyzed * 100, 1))
                .neutralPercentage(round((double) neutralCount / analyzed * 100, 1))
                .averagePredictedRating(round(totalPredictedRating / analyzed, 1))
                .aiGeneratedPercentage(round(totalAiProbability / analyzed * 100, 1))
                .averageAuthenticityScore(round(totalAuthenticityScore / analyzed, 1))
                .languagesDetected(new ArrayList<>(languages))
                .build();

        UUID userId = getAuthenticatedUserId();
        if (userId != null) {
            persistLinkAnalysis(userId, productUrl, domain, response, languages);
            log.info("Link analysis saved for user: {}", userId);
        }

        recordMetric(userId, domain, languages);

        log.info("Link analysis completed: {} reviews analyzed from {}", analyzed, domain);
        return response;
    }

    private String extractAndValidateDomain(String url) {
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (host == null) {
                throw new BadRequestException("Invalid URL: could not extract domain");
            }

            String normalizedHost = host.toLowerCase().replaceFirst("^www\\.", "");

            List<String> allowed = appProperties.getScraperService().getAllowedDomains();
            boolean isAllowed = allowed.stream().anyMatch(d -> normalizedHost.equals(d) || normalizedHost.endsWith("." + d));

            if (!isAllowed) {
                throw new BadRequestException(
                        "Domain not supported. Allowed domains: " + String.join(", ", allowed)
                );
            }
            return normalizedHost;
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid URL format: " + e.getMessage());
        }
    }

    private int computeAuthenticityScore(MlInferenceResponse mlResponse) {
        double aiScore = mlResponse.getAiProbability() * 100;
        double confidenceScore = (1 - mlResponse.getConfidence()) * 100;
        double composite = (aiScore * 0.60) + (confidenceScore * 0.40);
        return (int) Math.round(Math.min(100, Math.max(0, composite)));
    }

    private void persistLinkAnalysis(UUID userId, String productUrl, String domain,
                                     LinkAnalysisResponse response, Set<String> languages) {
        User user = userRepository.getReferenceById(userId);

        LinkAnalysis entity = LinkAnalysis.builder()
                .user(user)
                .encryptedProductUrl(encryptionUtil.encrypt(productUrl))
                .domain(domain)
                .totalReviewsAnalyzed(response.getTotalReviewsAnalyzed())
                .positivePercentage(response.getPositivePercentage())
                .negativePercentage(response.getNegativePercentage())
                .neutralPercentage(response.getNeutralPercentage())
                .averagePredictedRating(response.getAveragePredictedRating())
                .aiGeneratedPercentage(response.getAiGeneratedPercentage())
                .languagesDetected(String.join(", ", languages))
                .build();

        linkAnalysisRepository.save(entity);
    }

    @Async("metricsExecutor")
    void recordMetric(UUID userId, String domain, Set<String> languages) {
        try {
            for (String lang : languages) {
                AnalysisMetric metric = AnalysisMetric.builder()
                        .analysisType(AnalysisMetric.AnalysisType.PRODUCT_LINK)
                        .authenticated(userId != null)
                        .userId(userId)
                        .domain(domain)
                        .detectedLanguage(lang)
                        .build();

                analysisMetricRepository.save(metric);
            }
        } catch (Exception e) {
            log.error("Failed to record link analysis metric", e);
        }
    }

    private UUID getAuthenticatedUserId() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal principal) {
                return principal.getId();
            }
        } catch (Exception e) {
            log.debug("No authenticated user found");
        }
        return null;
    }

    private double round(double value, int places) {
        double factor = Math.pow(10, places);
        return Math.round(value * factor) / factor;
    }

    @Transactional
    public void saveLinkAnalysisSummary(SaveLinkAnalysisRequest request, UUID userId) {
        String productUrl = request.getProductUrl().trim();
        String domain;
        try {
            URI uri = URI.create(productUrl);
            String host = uri.getHost();
            domain = host != null ? host.toLowerCase().replaceFirst("^www\\.", "") : "unknown";
        } catch (Exception e) {
            domain = "unknown";
        }

        User user = userRepository.getReferenceById(userId);

        LinkAnalysis entity = LinkAnalysis.builder()
                .user(user)
                .encryptedProductUrl(encryptionUtil.encrypt(productUrl))
                .domain(domain)
                .totalReviewsAnalyzed(request.getTotalReviewsAnalyzed() != null ? request.getTotalReviewsAnalyzed() : 0)
                .positivePercentage(request.getPositivePercentage() != null ? request.getPositivePercentage() : 0)
                .negativePercentage(request.getNegativePercentage() != null ? request.getNegativePercentage() : 0)
                .neutralPercentage(request.getNeutralPercentage() != null ? request.getNeutralPercentage() : 0)
                .averagePredictedRating(request.getAveragePredictedRating() != null ? request.getAveragePredictedRating() : 0)
                .aiGeneratedPercentage(request.getAiGeneratedPercentage() != null ? request.getAiGeneratedPercentage() : 0)
                .languagesDetected(request.getLanguagesDetected() != null ? request.getLanguagesDetected() : "")
                .build();

        linkAnalysisRepository.save(entity);
        log.info("Link analysis summary saved for user: {} - {} reviews from {}", userId, request.getTotalReviewsAnalyzed(), domain);

        recordMetric(userId, domain, request.getLanguagesDetected() != null
                ? Set.of(request.getLanguagesDetected().split(",\\s*"))
                : Set.of());
    }
}
