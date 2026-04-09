package com.nlpreview.analyzer.service;

import com.nlpreview.analyzer.dto.response.PagedResponse;
import com.nlpreview.analyzer.dto.response.ReviewHistoryResponse;
import com.nlpreview.analyzer.entity.LinkAnalysis;
import com.nlpreview.analyzer.entity.ReviewAnalysis;
import com.nlpreview.analyzer.repository.LinkAnalysisRepository;
import com.nlpreview.analyzer.repository.ReviewAnalysisRepository;
import com.nlpreview.analyzer.util.EncryptionUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Slf4j
public class HistoryService {

    private final ReviewAnalysisRepository reviewAnalysisRepository;
    private final LinkAnalysisRepository linkAnalysisRepository;
    private final EncryptionUtil encryptionUtil;

    @Transactional(readOnly = true)
    public PagedResponse<ReviewHistoryResponse> getUserHistory(UUID userId, String type, int page, int size) {
        List<ReviewHistoryResponse> combined = new ArrayList<>();

        if (type == null || type.equalsIgnoreCase("REVIEW") || type.isEmpty()) {
            List<ReviewAnalysis> allReviews = reviewAnalysisRepository
                    .findByUserIdOrderByCreatedAtDesc(userId, Pageable.unpaged())
                    .getContent();
            combined.addAll(allReviews.stream()
                    .map(this::mapReviewAnalysis)
                    .collect(Collectors.toList()));
        }

        if (type == null || type.equalsIgnoreCase("LINK") || type.isEmpty()) {
            List<LinkAnalysis> allLinks = linkAnalysisRepository
                    .findByUserIdOrderByCreatedAtDesc(userId, Pageable.unpaged())
                    .getContent();
            combined.addAll(allLinks.stream()
                    .map(this::mapLinkAnalysis)
                    .collect(Collectors.toList()));
        }

        combined.sort(Comparator.comparing(ReviewHistoryResponse::getCreatedAt).reversed());

        long totalElements = combined.size();
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / size);

        int fromIndex = page * size;
        int toIndex = Math.min(fromIndex + size, combined.size());
        List<ReviewHistoryResponse> pageContent = fromIndex < combined.size()
                ? combined.subList(fromIndex, toIndex)
                : Collections.emptyList();

        return PagedResponse.<ReviewHistoryResponse>builder()
                .content(pageContent)
                .page(page)
                .size(size)
                .totalElements(totalElements)
                .totalPages(totalPages)
                .last(page >= totalPages - 1)
                .build();
    }

    private ReviewHistoryResponse mapReviewAnalysis(ReviewAnalysis ra) {
        return ReviewHistoryResponse.builder()
                .id(ra.getId())
                .analysisType("INDIVIDUAL_REVIEW")
                .reviewTextPreview(encryptionUtil.decrypt(ra.getEncryptedReviewText()))
                .sentiment(ra.getSentiment())
                .predictedRating(ra.getPredictedRating())
                .aiGeneratedProbability(ra.getAiGeneratedProbability())
                .authenticityScore(ra.getAuthenticityScore())
                .authenticityLabel(classifyAuthenticity(ra.getAuthenticityScore()))
                .confidence(ra.getConfidence())
                .detectedLanguage(ra.getDetectedLanguage())
                .createdAt(ra.getCreatedAt())
                .build();
    }

    private ReviewHistoryResponse mapLinkAnalysis(LinkAnalysis la) {
        return ReviewHistoryResponse.builder()
                .id(la.getId())
                .analysisType("PRODUCT_LINK")
                .productUrlPreview(encryptionUtil.decrypt(la.getEncryptedProductUrl()))
                .domain(la.getDomain())
                .totalReviewsAnalyzed(la.getTotalReviewsAnalyzed())
                .positivePercentage(la.getPositivePercentage())
                .negativePercentage(la.getNegativePercentage())
                .neutralPercentage(la.getNeutralPercentage())
                .averagePredictedRating(la.getAveragePredictedRating())
                .aiGeneratedPercentage(la.getAiGeneratedPercentage())
                .languagesDetected(la.getLanguagesDetected())
                .createdAt(la.getCreatedAt())
                .build();
    }

    private String classifyAuthenticity(Integer score) {
        if (score == null) return null;
        if (score <= 40) return "Likely Genuine";
        if (score <= 70) return "Suspicious";
        return "Highly Suspicious";
    }
}
