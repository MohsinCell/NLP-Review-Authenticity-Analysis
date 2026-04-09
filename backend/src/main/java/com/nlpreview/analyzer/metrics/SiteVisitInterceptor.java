package com.nlpreview.analyzer.metrics;

import com.nlpreview.analyzer.service.SiteVisitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
@Slf4j
public class SiteVisitInterceptor implements HandlerInterceptor {

    private final SiteVisitService siteVisitService;

    private static final String START_TIME_ATTR = "requestStartTime";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute(START_TIME_ATTR, System.currentTimeMillis());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        try {
            long startTime = (Long) request.getAttribute(START_TIME_ATTR);
            long responseTime = System.currentTimeMillis() - startTime;

            String endpoint = request.getRequestURI();
            String httpMethod = request.getMethod();
            String ipAddress = getClientIp(request);
            String userAgent = request.getHeader("User-Agent");

            siteVisitService.recordVisit(
                    endpoint, httpMethod, ipAddress, userAgent,
                    response.getStatus(), responseTime
            );
        } catch (Exception e) {
            log.debug("Failed to record site visit: {}", e.getMessage());
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }
}
