package com.nlpreview.analyzer.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminMetricsResponse {
    private long totalUsers;
    private long totalAnalyses;
    private long analysesByAuthenticatedUsers;
    private long analysesByAnonymousUsers;
    private long individualReviewAnalyses;
    private long linkAnalyses;
    private Map<String, Long> languageDistribution;
    private Map<String, Long> domainDistribution;
}
