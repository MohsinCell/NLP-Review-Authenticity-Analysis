package com.nlpreview.analyzer.controller;

import com.nlpreview.analyzer.dto.request.LinkAnalysisRequest;
import com.nlpreview.analyzer.dto.request.ReviewAnalysisRequest;
import com.nlpreview.analyzer.dto.request.SaveLinkAnalysisRequest;
import com.nlpreview.analyzer.dto.response.LinkAnalysisResponse;
import com.nlpreview.analyzer.dto.response.MessageResponse;
import com.nlpreview.analyzer.dto.response.ReviewAnalysisResponse;
import com.nlpreview.analyzer.security.UserPrincipal;
import com.nlpreview.analyzer.service.LinkAnalysisService;
import com.nlpreview.analyzer.service.ReviewAnalysisService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/reviews")
@RequiredArgsConstructor
@Slf4j
public class ReviewController {

    private final ReviewAnalysisService reviewAnalysisService;
    private final LinkAnalysisService linkAnalysisService;

    @PostMapping("/analyze")
    public ResponseEntity<ReviewAnalysisResponse> analyzeReview(
            @Valid @RequestBody ReviewAnalysisRequest request) {
        log.info("Review analysis request received, text length: {}", request.getReviewText().length());
        ReviewAnalysisResponse response = reviewAnalysisService.analyzeReview(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/analyze-link")
    public ResponseEntity<LinkAnalysisResponse> analyzeProductLink(
            @Valid @RequestBody LinkAnalysisRequest request) {
        log.info("Link analysis request received for URL: {}", request.getProductUrl());
        LinkAnalysisResponse response = linkAnalysisService.analyzeProductLink(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/save-link-analysis")
    public ResponseEntity<MessageResponse> saveLinkAnalysis(
            @Valid @RequestBody SaveLinkAnalysisRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.ok(MessageResponse.builder().message("Not authenticated, skipped saving").build());
        }
        log.info("Saving link analysis summary for user: {}", principal.getId());
        linkAnalysisService.saveLinkAnalysisSummary(request, principal.getId());
        return ResponseEntity.ok(MessageResponse.builder().message("Link analysis saved").build());
    }
}
