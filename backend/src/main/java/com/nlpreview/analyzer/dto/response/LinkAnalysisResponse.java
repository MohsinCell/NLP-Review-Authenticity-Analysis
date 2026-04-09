package com.nlpreview.analyzer.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LinkAnalysisResponse {
    private int totalReviewsAnalyzed;
    private double positivePercentage;
    private double negativePercentage;
    private double neutralPercentage;
    private double averagePredictedRating;
    private double aiGeneratedPercentage;
    private double averageAuthenticityScore;
    private List<String> languagesDetected;
}
