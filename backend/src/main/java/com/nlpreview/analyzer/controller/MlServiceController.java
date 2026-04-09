package com.nlpreview.analyzer.controller;

import com.nlpreview.analyzer.dto.response.KeywordExtractionResponse;
import com.nlpreview.analyzer.dto.response.ProductTrustReportResponse;
import com.nlpreview.analyzer.dto.response.RedFlagsResponse;
import com.nlpreview.analyzer.integration.MlServiceClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/ml-service")
@RequiredArgsConstructor
@Slf4j
public class MlServiceController {

    private final MlServiceClient mlServiceClient;

    @PostMapping("/extract-keywords")
    public ResponseEntity<KeywordExtractionResponse> extractKeywords(@RequestBody ExtractKeywordsRequest request) {
        log.info("Keyword extraction request for {} reviews", request.getReviews().size());

        if (request.getReviews() == null || request.getReviews().isEmpty()) {
            throw new IllegalArgumentException("At least one review is required");
        }

        KeywordExtractionResponse response = mlServiceClient.extractKeywords(request.getReviews());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/detect-red-flags")
    public ResponseEntity<RedFlagsResponse> detectRedFlags(@RequestBody DetectRedFlagsRequest request) {
        log.info("Red flags detection request for review (length={})", request.getReviewText().length());

        if (request.getReviewText() == null || request.getReviewText().isBlank()) {
            throw new IllegalArgumentException("Review text is required");
        }

        RedFlagsResponse response = mlServiceClient.detectRedFlags(request.getReviewText());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/product-trust-report")
    public ResponseEntity<ProductTrustReportResponse> productTrustReport(@RequestBody ProductTrustReportRequest request) {
        log.info("Product trust report request for {} reviews", request.getReviews().size());

        if (request.getReviews() == null || request.getReviews().size() < 3) {
            throw new IllegalArgumentException("At least 3 reviews are required");
        }

        ProductTrustReportResponse response = mlServiceClient.getProductTrustReport(request.getReviews());
        return ResponseEntity.ok(response);
    }

    @lombok.Data
    public static class ExtractKeywordsRequest {
        private List<String> reviews;
    }

    @lombok.Data
    public static class DetectRedFlagsRequest {
        private String reviewText;
    }

    @lombok.Data
    public static class ProductTrustReportRequest {
        private List<Map<String, Object>> reviews;
    }
}
