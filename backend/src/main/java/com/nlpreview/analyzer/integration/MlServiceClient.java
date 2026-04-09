package com.nlpreview.analyzer.integration;

import com.nlpreview.analyzer.config.AppProperties;
import com.nlpreview.analyzer.dto.response.KeywordExtractionResponse;
import com.nlpreview.analyzer.dto.response.MlInferenceResponse;
import com.nlpreview.analyzer.dto.response.ProductTrustReportResponse;
import com.nlpreview.analyzer.dto.response.RedFlagsResponse;
import com.nlpreview.analyzer.exception.ServiceUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class MlServiceClient {

    private final RestTemplate restTemplate;
    private final AppProperties appProperties;

    public MlServiceClient(@Qualifier("mlRestTemplate") RestTemplate restTemplate,
                           AppProperties appProperties) {
        this.restTemplate = restTemplate;
        this.appProperties = appProperties;
    }

    public MlInferenceResponse analyzeReview(String reviewText) {
        String url = appProperties.getMlService().getBaseUrl() + "/ml/analyze";
        int maxAttempts = appProperties.getMlService().getRetryMaxAttempts();
        int retryDelay = appProperties.getMlService().getRetryDelayMs();

        Map<String, String> requestBody = Map.of("reviewText", reviewText);

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                log.debug("ML inference attempt {}/{} for review (length={})", attempt, maxAttempts, reviewText.length());

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);

                HttpEntity<Map<String, String>> entity = new HttpEntity<>(requestBody, headers);

                ResponseEntity<MlInferenceResponse> response = restTemplate.exchange(
                        url,
                        HttpMethod.POST,
                        entity,
                        MlInferenceResponse.class
                );

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    log.debug("ML inference successful on attempt {}", attempt);
                    return response.getBody();
                }

                log.warn("ML service returned non-success status: {}", response.getStatusCode());

            } catch (ResourceAccessException e) {
                log.warn("ML service connection failed on attempt {}/{}: {}", attempt, maxAttempts, e.getMessage());
                if (attempt < maxAttempts) {
                    sleep(retryDelay * attempt);
                }
            } catch (Exception e) {
                log.error("ML inference failed on attempt {}/{}", attempt, maxAttempts, e);
                if (attempt < maxAttempts) {
                    sleep(retryDelay * attempt);
                }
            }
        }

        throw new ServiceUnavailableException("ML inference service is unavailable after " + maxAttempts + " attempts");
    }

    public KeywordExtractionResponse extractKeywords(List<String> reviews) {
        String url = appProperties.getMlService().getBaseUrl() + "/ml/extract-keywords";
        int maxAttempts = appProperties.getMlService().getRetryMaxAttempts();
        int retryDelay = appProperties.getMlService().getRetryDelayMs();

        Map<String, Object> requestBody = Map.of("reviews", reviews);

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                log.debug("Keyword extraction attempt {}/{} for {} reviews", attempt, maxAttempts, reviews.size());

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

                ResponseEntity<KeywordExtractionResponse> response = restTemplate.exchange(
                        url,
                        HttpMethod.POST,
                        entity,
                        KeywordExtractionResponse.class
                );

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    log.debug("Keyword extraction successful on attempt {}", attempt);
                    return response.getBody();
                }

                log.warn("Keyword extraction service returned non-success status: {}", response.getStatusCode());

            } catch (ResourceAccessException e) {
                log.warn("Keyword extraction connection failed on attempt {}/{}: {}", attempt, maxAttempts, e.getMessage());
                if (attempt < maxAttempts) {
                    sleep(retryDelay * attempt);
                }
            } catch (Exception e) {
                log.error("Keyword extraction failed on attempt {}/{}", attempt, maxAttempts, e);
                if (attempt < maxAttempts) {
                    sleep(retryDelay * attempt);
                }
            }
        }

        throw new ServiceUnavailableException("Keyword extraction service is unavailable after " + maxAttempts + " attempts");
    }

    public RedFlagsResponse detectRedFlags(String reviewText) {
        String url = appProperties.getMlService().getBaseUrl() + "/ml/detect-red-flags";
        int maxAttempts = appProperties.getMlService().getRetryMaxAttempts();
        int retryDelay = appProperties.getMlService().getRetryDelayMs();

        Map<String, String> requestBody = Map.of("reviewText", reviewText);

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                log.debug("Red flags detection attempt {}/{}", attempt, maxAttempts);

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);

                HttpEntity<Map<String, String>> entity = new HttpEntity<>(requestBody, headers);

                ResponseEntity<RedFlagsResponse> response = restTemplate.exchange(
                        url,
                        HttpMethod.POST,
                        entity,
                        RedFlagsResponse.class
                );

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    log.debug("Red flags detection successful on attempt {}", attempt);
                    return response.getBody();
                }

                log.warn("Red flags service returned non-success status: {}", response.getStatusCode());

            } catch (ResourceAccessException e) {
                log.warn("Red flags connection failed on attempt {}/{}: {}", attempt, maxAttempts, e.getMessage());
                if (attempt < maxAttempts) {
                    sleep(retryDelay * attempt);
                }
            } catch (Exception e) {
                log.error("Red flags detection failed on attempt {}/{}", attempt, maxAttempts, e);
                if (attempt < maxAttempts) {
                    sleep(retryDelay * attempt);
                }
            }
        }

        throw new ServiceUnavailableException("Red flags detection service is unavailable after " + maxAttempts + " attempts");
    }

    public ProductTrustReportResponse getProductTrustReport(List<Map<String, Object>> reviews) {
        String url = appProperties.getMlService().getBaseUrl() + "/ml/product-trust-report";
        int maxAttempts = appProperties.getMlService().getRetryMaxAttempts();
        int retryDelay = appProperties.getMlService().getRetryDelayMs();

        Map<String, Object> requestBody = Map.of("reviews", reviews);

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                log.debug("Product trust report attempt {}/{} for {} reviews", attempt, maxAttempts, reviews.size());

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

                ResponseEntity<ProductTrustReportResponse> response = restTemplate.exchange(
                        url,
                        HttpMethod.POST,
                        entity,
                        ProductTrustReportResponse.class
                );

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    log.debug("Product trust report successful on attempt {}", attempt);
                    return response.getBody();
                }

                log.warn("Product trust report service returned non-success status: {}", response.getStatusCode());

            } catch (ResourceAccessException e) {
                log.warn("Product trust report connection failed on attempt {}/{}: {}", attempt, maxAttempts, e.getMessage());
                if (attempt < maxAttempts) {
                    sleep(retryDelay * attempt);
                }
            } catch (Exception e) {
                log.error("Product trust report failed on attempt {}/{}", attempt, maxAttempts, e);
                if (attempt < maxAttempts) {
                    sleep(retryDelay * attempt);
                }
            }
        }

        throw new ServiceUnavailableException("Product trust report service is unavailable after " + maxAttempts + " attempts");
    }

    private void sleep(int ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
