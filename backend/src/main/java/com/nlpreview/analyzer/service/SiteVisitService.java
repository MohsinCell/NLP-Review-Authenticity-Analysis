package com.nlpreview.analyzer.service;

import com.nlpreview.analyzer.entity.SiteVisit;
import com.nlpreview.analyzer.repository.SiteVisitRepository;
import com.nlpreview.analyzer.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class SiteVisitService {

    private final SiteVisitRepository siteVisitRepository;

    @Async("metricsExecutor")
    public void recordVisit(String endpoint, String httpMethod, String ipAddress,
                            String userAgent, int responseStatus, long responseTimeMs) {
        try {
            UUID userId = null;
            boolean authenticated = false;

            try {
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
                    userId = principal.getId();
                    authenticated = true;
                }
            } catch (Exception ignored) {

            }

            SiteVisit visit = SiteVisit.builder()
                    .endpoint(truncate(endpoint, 255))
                    .httpMethod(httpMethod)
                    .authenticated(authenticated)
                    .ipAddress(truncate(ipAddress, 45))
                    .userAgent(truncate(userAgent, 512))
                    .userId(userId)
                    .responseStatus(responseStatus)
                    .responseTimeMs(responseTimeMs)
                    .build();

            siteVisitRepository.save(visit);
        } catch (Exception e) {
            log.error("Failed to record site visit for endpoint: {}", endpoint, e);
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }
}
