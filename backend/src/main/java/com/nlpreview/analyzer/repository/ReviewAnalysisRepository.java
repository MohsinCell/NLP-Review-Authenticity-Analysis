package com.nlpreview.analyzer.repository;

import com.nlpreview.analyzer.entity.ReviewAnalysis;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface ReviewAnalysisRepository extends JpaRepository<ReviewAnalysis, UUID> {
    Page<ReviewAnalysis> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
    long countByUserId(UUID userId);
    long countByCreatedAtAfter(Instant after);

    @Modifying
    @Query("DELETE FROM ReviewAnalysis r WHERE r.user.id = :userId")
    void deleteAllByUserId(UUID userId);
}
