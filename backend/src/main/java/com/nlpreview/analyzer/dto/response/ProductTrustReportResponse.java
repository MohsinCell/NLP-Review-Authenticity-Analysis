package com.nlpreview.analyzer.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductTrustReportResponse {
    private int trustScore;
    private String trustLabel;
    private int totalReviews;
    private Map<String, DetectionResult> detections;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DetectionResult {
        private boolean detected;
        private String severity;
        private int score;
        private String details;
        private List<Integer> flaggedIndices;
        // Optional fields for specific detections
        private Map<String, Integer> distribution;
        private Map<String, Object> stats;
        private List<Map<String, Object>> clusters;
        private List<Map<String, Object>> repeatedPhrases;
    }
}
