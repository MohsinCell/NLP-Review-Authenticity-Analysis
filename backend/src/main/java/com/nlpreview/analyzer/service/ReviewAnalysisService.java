package com.nlpreview.analyzer.service;

import com.nlpreview.analyzer.dto.request.ReviewAnalysisRequest;
import com.nlpreview.analyzer.dto.response.MlInferenceResponse;
import com.nlpreview.analyzer.dto.response.ReviewAnalysisResponse;
import com.nlpreview.analyzer.entity.AnalysisMetric;
import com.nlpreview.analyzer.entity.ReviewAnalysis;
import com.nlpreview.analyzer.entity.User;
import com.nlpreview.analyzer.integration.MlServiceClient;
import com.nlpreview.analyzer.repository.AnalysisMetricRepository;
import com.nlpreview.analyzer.repository.ReviewAnalysisRepository;
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

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewAnalysisService {

    private final MlServiceClient mlServiceClient;
    private final ReviewAnalysisRepository reviewAnalysisRepository;
    private final UserRepository userRepository;
    private final AnalysisMetricRepository analysisMetricRepository;
    private final EncryptionUtil encryptionUtil;
    private final LanguageDetector languageDetector;
    private final TranslationService translationService;

    @Transactional
    public ReviewAnalysisResponse analyzeReview(ReviewAnalysisRequest request) {
        String originalText = request.getReviewText().trim();

        log.info("Starting review analysis, text length: {}", originalText.length());

        // Call ML service with original text -- runs all models and returns fused results
        MlInferenceResponse mlResponse = mlServiceClient.analyzeReview(originalText);
        log.debug("ML inference completed: sentiment={}, rating={}",
                mlResponse.getSentiment(), mlResponse.getRating());

        String detectedLanguage = languageDetector.detectLanguage(originalText);
        String languageName = detectedLanguage;

        if ("hi-en".equalsIgnoreCase(detectedLanguage) || "hi".equalsIgnoreCase(detectedLanguage)) {
            detectedLanguage = "en";
            languageName = "English";
        }

        String textToAnalyze = originalText;
        boolean wasTranslated = false;
        if (!"en".equalsIgnoreCase(detectedLanguage) && !"english".equalsIgnoreCase(detectedLanguage)) {
            log.info("Non-English text detected ({}). Attempting translation to English...", detectedLanguage);
            String translated = translationService.translateToEnglish(originalText, detectedLanguage);
            if (!translated.equals(originalText)) {
                wasTranslated = true;
                textToAnalyze = translated;
                log.info("Translation completed. Re-analyzing translated text...");
                // Re-analyze translated text for better ML model accuracy
                mlResponse = mlServiceClient.analyzeReview(textToAnalyze);
            }
        }

        int authenticityScore = computeAuthenticityScore(mlResponse);
        String authenticityLabel = classifyAuthenticity(authenticityScore);

        ReviewAnalysisResponse response = ReviewAnalysisResponse.builder()
                .sentiment(mlResponse.getSentiment())
                .predictedRating(mlResponse.getRating())
                .aiGeneratedProbability(round(mlResponse.getAiProbability(), 4))
                .authenticityScore(authenticityScore)
                .confidence(round(mlResponse.getConfidence(), 4))
                .language(detectedLanguage)
                .languageName(languageName)
                .authenticityLabel(authenticityLabel)
                .originalText(originalText)
                .translatedText(wasTranslated ? textToAnalyze : null)
                .wasTranslated(wasTranslated)
                .build();

        UUID userId = getAuthenticatedUserId();
        if (userId != null) {
            persistReviewAnalysis(userId, originalText, response, detectedLanguage);
            log.info("Review analysis saved for user: {}", userId);
        }

        recordMetric(userId, detectedLanguage);

        log.info("Review analysis completed: sentiment={}, authenticity={}", response.getSentiment(), authenticityScore);
        return response;
    }

    private int computeAuthenticityScore(MlInferenceResponse mlResponse) {

        double aiWeight = 0.50;
        double confidenceWeight = 0.20;
        double ratingMismatchWeight = 0.30;

        double aiScore = mlResponse.getAiProbability() * 100;

        double confidenceScore = (1 - mlResponse.getConfidence()) * 100;

        double ratingMismatch = computeRatingMismatch(mlResponse.getSentiment(), mlResponse.getRating());

        double composite = (aiScore * aiWeight) + (confidenceScore * confidenceWeight) + (ratingMismatch * ratingMismatchWeight);

        return (int) Math.round(Math.min(100, Math.max(0, composite)));
    }

    private double computeRatingMismatch(String sentiment, int rating) {
        if (sentiment == null) return 50;

        return switch (sentiment.toLowerCase()) {
            case "positive" -> rating <= 2 ? 80 : (rating == 3 ? 40 : 0);
            case "negative" -> rating >= 4 ? 80 : (rating == 3 ? 40 : 0);
            case "neutral" -> (rating == 1 || rating == 5) ? 50 : 10;
            default -> 30;
        };
    }

    private String classifyAuthenticity(int score) {
        if (score <= 40) return "Likely Genuine";
        if (score <= 70) return "Suspicious";
        return "Highly Suspicious";
    }

    private void persistReviewAnalysis(UUID userId, String reviewText, ReviewAnalysisResponse response, String language) {
        User user = userRepository.getReferenceById(userId);

        ReviewAnalysis entity = ReviewAnalysis.builder()
                .user(user)
                .encryptedReviewText(encryptionUtil.encrypt(reviewText))
                .sentiment(response.getSentiment())
                .predictedRating(response.getPredictedRating())
                .aiGeneratedProbability(response.getAiGeneratedProbability())
                .authenticityScore(response.getAuthenticityScore())
                .confidence(response.getConfidence())
                .detectedLanguage(language)
                .build();

        reviewAnalysisRepository.save(entity);
    }

    @Async("metricsExecutor")
    void recordMetric(UUID userId, String language) {
        try {
            AnalysisMetric metric = AnalysisMetric.builder()
                    .analysisType(AnalysisMetric.AnalysisType.INDIVIDUAL_REVIEW)
                    .authenticated(userId != null)
                    .userId(userId)
                    .detectedLanguage(language)
                    .build();

            analysisMetricRepository.save(metric);
        } catch (Exception e) {
            log.error("Failed to record analysis metric", e);
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
}
