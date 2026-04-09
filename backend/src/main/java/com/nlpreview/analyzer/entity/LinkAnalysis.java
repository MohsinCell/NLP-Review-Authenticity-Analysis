package com.nlpreview.analyzer.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "link_analyses", indexes = {
        @Index(name = "idx_link_analyses_user_id", columnList = "user_id"),
        @Index(name = "idx_link_analyses_created_at", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LinkAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String encryptedProductUrl;

    @Column(nullable = false, length = 100)
    private String domain;

    @Column(nullable = false)
    private int totalReviewsAnalyzed;

    @Column(nullable = false)
    private double positivePercentage;

    @Column(nullable = false)
    private double negativePercentage;

    @Column(nullable = false)
    private double neutralPercentage;

    @Column(nullable = false)
    private double averagePredictedRating;

    @Column(nullable = false)
    private double aiGeneratedPercentage;

    @Column(length = 500)
    private String languagesDetected;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
