package com.nlpreview.analyzer.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaveLinkAnalysisRequest {

    @NotBlank(message = "Product URL is required")
    private String productUrl;

    @NotNull(message = "Total reviews analyzed is required")
    private Integer totalReviewsAnalyzed;

    private Double positivePercentage;
    private Double negativePercentage;
    private Double neutralPercentage;
    private Double averagePredictedRating;
    private Double aiGeneratedPercentage;
    private String languagesDetected;
}
