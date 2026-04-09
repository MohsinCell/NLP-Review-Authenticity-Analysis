package com.nlpreview.analyzer.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "review_analyses", indexes = {
        @Index(name = "idx_review_analyses_user_id", columnList = "user_id"),
        @Index(name = "idx_review_analyses_created_at", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String encryptedReviewText;

    @Column(nullable = false, length = 20)
    private String sentiment;

    @Column(nullable = false)
    private int predictedRating;

    @Column(nullable = false)
    private double aiGeneratedProbability;

    @Column(nullable = false)
    private int authenticityScore;

    @Column(nullable = false)
    private double confidence;

    @Column(nullable = false, length = 50)
    private String detectedLanguage;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
