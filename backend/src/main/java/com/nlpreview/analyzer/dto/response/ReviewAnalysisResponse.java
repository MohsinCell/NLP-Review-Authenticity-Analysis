package com.nlpreview.analyzer.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewAnalysisResponse {
    private String sentiment;
    private int predictedRating;
    private double aiGeneratedProbability;
    private int authenticityScore;
    private double confidence;
    private String language;
    private String languageName;
    private String authenticityLabel;
    private String originalText;
    private String translatedText;
    private boolean wasTranslated;
}
