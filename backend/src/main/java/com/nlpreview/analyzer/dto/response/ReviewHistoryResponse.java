package com.nlpreview.analyzer.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ReviewHistoryResponse {
    private UUID id;
    private String analysisType;

    private String reviewTextPreview;
    private String sentiment;
    private Integer predictedRating;
    private Double aiGeneratedProbability;
    private Integer authenticityScore;
    private String authenticityLabel;
    private Double confidence;
    private String detectedLanguage;

    private String productUrlPreview;
    private String domain;
    private Integer totalReviewsAnalyzed;
    private Double positivePercentage;
    private Double negativePercentage;
    private Double neutralPercentage;
    private Double averagePredictedRating;
    private Double aiGeneratedPercentage;
    private String languagesDetected;

    private Instant createdAt;
}
