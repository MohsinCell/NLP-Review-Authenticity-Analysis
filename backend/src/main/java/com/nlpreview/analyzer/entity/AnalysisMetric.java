package com.nlpreview.analyzer.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "analysis_metrics", indexes = {
        @Index(name = "idx_analysis_metrics_created_at", columnList = "createdAt"),
        @Index(name = "idx_analysis_metrics_type", columnList = "analysisType")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnalysisMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AnalysisType analysisType;

    @Column(nullable = false)
    private boolean authenticated;

    @Column
    private UUID userId;

    @Column(length = 50)
    private String detectedLanguage;

    @Column(length = 100)
    private String domain;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public enum AnalysisType {
        INDIVIDUAL_REVIEW,
        PRODUCT_LINK
    }
}
