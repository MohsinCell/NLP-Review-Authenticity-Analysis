package com.nlpreview.analyzer.service;

import com.nlpreview.analyzer.dto.response.*;
import com.nlpreview.analyzer.entity.AnalysisMetric;
import com.nlpreview.analyzer.entity.User;
import com.nlpreview.analyzer.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminService {

    private final UserRepository userRepository;
    private final AnalysisMetricRepository analysisMetricRepository;
    private final SiteVisitRepository siteVisitRepository;
    private final ReviewAnalysisRepository reviewAnalysisRepository;
    private final LinkAnalysisRepository linkAnalysisRepository;

    @Transactional(readOnly = true)
    public AdminMetricsResponse getMetrics() {
        Map<String, Long> languageDistribution = analysisMetricRepository.findLanguageDistribution()
                .stream()
                .collect(Collectors.toMap(
                        row -> (String) row[0],
                        row -> (Long) row[1],
                        (a, b) -> a,
                        LinkedHashMap::new
                ));

        Map<String, Long> domainDistribution = analysisMetricRepository.findDomainDistribution()
                .stream()
                .collect(Collectors.toMap(
                        row -> (String) row[0],
                        row -> (Long) row[1],
                        (a, b) -> a,
                        LinkedHashMap::new
                ));

        return AdminMetricsResponse.builder()
                .totalUsers(userRepository.count())
                .totalAnalyses(analysisMetricRepository.count())
                .analysesByAuthenticatedUsers(analysisMetricRepository.countByAuthenticatedTrue())
                .analysesByAnonymousUsers(analysisMetricRepository.countByAuthenticatedFalse())
                .individualReviewAnalyses(analysisMetricRepository.countByAnalysisType(AnalysisMetric.AnalysisType.INDIVIDUAL_REVIEW))
                .linkAnalyses(analysisMetricRepository.countByAnalysisType(AnalysisMetric.AnalysisType.PRODUCT_LINK))
                .languageDistribution(languageDistribution)
                .domainDistribution(domainDistribution)
                .build();
    }

    @Transactional(readOnly = true)
    public PagedResponse<AdminUserListResponse> getUsers(int page, int size) {
        Page<User> userPage = userRepository.findAll(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );

        List<AdminUserListResponse> users = userPage.getContent().stream()
                .map(user -> AdminUserListResponse.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .fullName(user.getFullName())
                        .role(user.getRole().name())
                        .enabled(user.isEnabled())
                        .createdAt(user.getCreatedAt())
                        .totalAnalyses(
                                reviewAnalysisRepository.countByUserId(user.getId()) +
                                        linkAnalysisRepository.countByUserId(user.getId())
                        )
                        .build())
                .collect(Collectors.toList());

        return PagedResponse.<AdminUserListResponse>builder()
                .content(users)
                .page(page)
                .size(size)
                .totalElements(userPage.getTotalElements())
                .totalPages(userPage.getTotalPages())
                .last(userPage.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getAnalysisCount() {
        Instant last24h = Instant.now().minus(24, ChronoUnit.HOURS);
        Instant last7d = Instant.now().minus(7, ChronoUnit.DAYS);
        Instant last30d = Instant.now().minus(30, ChronoUnit.DAYS);

        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("total", analysisMetricRepository.count());
        counts.put("last24Hours", analysisMetricRepository.countByCreatedAtAfter(last24h));
        counts.put("last7Days", analysisMetricRepository.countByCreatedAtAfter(last7d));
        counts.put("last30Days", analysisMetricRepository.countByCreatedAtAfter(last30d));
        counts.put("individualReviews", analysisMetricRepository.countByAnalysisType(AnalysisMetric.AnalysisType.INDIVIDUAL_REVIEW));
        counts.put("linkAnalyses", analysisMetricRepository.countByAnalysisType(AnalysisMetric.AnalysisType.PRODUCT_LINK));
        return counts;
    }

    @Transactional(readOnly = true)
    public AdminVisitsResponse getVisits() {
        Instant now = Instant.now();
        Instant last24h = now.minus(24, ChronoUnit.HOURS);
        Instant last7d = now.minus(7, ChronoUnit.DAYS);
        Instant last30d = now.minus(30, ChronoUnit.DAYS);

        return AdminVisitsResponse.builder()
                .totalVisits(siteVisitRepository.count())
                .visitsLast24Hours(siteVisitRepository.countVisitsSince(last24h))
                .visitsLast7Days(siteVisitRepository.countVisitsSince(last7d))
                .visitsLast30Days(siteVisitRepository.countVisitsSince(last30d))
                .uniqueVisitorsLast24Hours(siteVisitRepository.countUniqueVisitorsSince(last24h))
                .uniqueVisitorsLast7Days(siteVisitRepository.countUniqueVisitorsSince(last7d))
                .authenticatedVisits(siteVisitRepository.countByAuthenticatedTrue())
                .anonymousVisits(siteVisitRepository.countByAuthenticatedFalse())
                .build();
    }
}
