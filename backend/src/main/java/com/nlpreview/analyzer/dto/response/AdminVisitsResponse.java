package com.nlpreview.analyzer.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminVisitsResponse {
    private long totalVisits;
    private long visitsLast24Hours;
    private long visitsLast7Days;
    private long visitsLast30Days;
    private long uniqueVisitorsLast24Hours;
    private long uniqueVisitorsLast7Days;
    private long authenticatedVisits;
    private long anonymousVisits;
}
