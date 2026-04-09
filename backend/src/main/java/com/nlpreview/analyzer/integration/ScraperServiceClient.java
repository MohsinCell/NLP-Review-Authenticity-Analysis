package com.nlpreview.analyzer.integration;

import com.nlpreview.analyzer.config.AppProperties;
import com.nlpreview.analyzer.dto.response.ScraperReviewDto;
import com.nlpreview.analyzer.exception.ServiceUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class ScraperServiceClient {

    private final RestTemplate restTemplate;
    private final AppProperties appProperties;

    public ScraperServiceClient(@Qualifier("scraperRestTemplate") RestTemplate restTemplate,
                                AppProperties appProperties) {
        this.restTemplate = restTemplate;
        this.appProperties = appProperties;
    }

    @SuppressWarnings("unchecked")
    public List<ScraperReviewDto> scrapeReviews(String productUrl) {
        String baseUrl = appProperties.getScraperService().getBaseUrl();
        int pollInterval = appProperties.getScraperService().getPollIntervalMs();
        int maxPolls = appProperties.getScraperService().getMaxPollAttempts();

        try {

            Map<String, Object> scrapeRequest = Map.of(
                    "url", productUrl,
                    "max_pages", 3,
                    "min_delay", 2,
                    "max_delay", 4,
                    "render_js", true
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(scrapeRequest, headers);

            ResponseEntity<Map> startResponse = restTemplate.exchange(
                    baseUrl + "/api/scrape",
                    HttpMethod.POST,
                    entity,
                    Map.class
            );

            if (!startResponse.getStatusCode().is2xxSuccessful() || startResponse.getBody() == null) {
                throw new ServiceUnavailableException("Failed to start scrape job");
            }

            String jobId = (String) startResponse.getBody().get("job_id");
            if (jobId == null) {
                throw new ServiceUnavailableException("Scraper did not return a job ID");
            }

            log.info("Scrape job started with ID: {}", jobId);

            for (int poll = 0; poll < maxPolls; poll++) {
                Thread.sleep(pollInterval);

                ResponseEntity<Map> statusResponse = restTemplate.getForEntity(
                        baseUrl + "/api/status/" + jobId,
                        Map.class
                );

                if (!statusResponse.getStatusCode().is2xxSuccessful() || statusResponse.getBody() == null) {
                    continue;
                }

                Map<String, Object> status = statusResponse.getBody();
                String jobStatus = (String) status.get("status");

                log.debug("Scrape job {} status: {}, reviews: {}", jobId, jobStatus, status.get("total_reviews"));

                if ("completed".equals(jobStatus)) {
                    List<Map<String, Object>> reviews = (List<Map<String, Object>>) status.get("reviews");
                    if (reviews == null || reviews.isEmpty()) {
                        return Collections.emptyList();
                    }
                    return reviews.stream()
                            .map(r -> ScraperReviewDto.builder()
                                    .text((String) r.get("text"))
                                    .rating(toDouble(r.get("rating")))
                                    .date((String) r.get("date"))
                                    .build())
                            .toList();
                } else if ("failed".equals(jobStatus)) {
                    String error = (String) status.getOrDefault("error", "Unknown scraper error");
                    throw new ServiceUnavailableException("Scrape job failed: " + error);
                }

            }

            throw new ServiceUnavailableException("Scrape job timed out after " + maxPolls + " poll attempts");

        } catch (ServiceUnavailableException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ServiceUnavailableException("Scrape operation was interrupted");
        } catch (Exception e) {
            log.error("Scraper service communication failed", e);
            throw new ServiceUnavailableException("Scraper service is unavailable: " + e.getMessage());
        }
    }

    private double toDouble(Object value) {
        if (value == null) return 0.0;
        if (value instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }
}
