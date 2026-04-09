package com.nlpreview.analyzer.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "site_visits", indexes = {
        @Index(name = "idx_site_visits_created_at", columnList = "createdAt"),
        @Index(name = "idx_site_visits_endpoint", columnList = "endpoint")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SiteVisit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 255)
    private String endpoint;

    @Column(nullable = false, length = 10)
    private String httpMethod;

    @Column(nullable = false)
    private boolean authenticated;

    @Column(length = 45)
    private String ipAddress;

    @Column(length = 512)
    private String userAgent;

    @Column
    private UUID userId;

    @Column(nullable = false)
    private int responseStatus;

    @Column(nullable = false)
    private long responseTimeMs;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
