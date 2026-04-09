package com.nlpreview.analyzer.repository;

import com.nlpreview.analyzer.entity.LinkAnalysis;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface LinkAnalysisRepository extends JpaRepository<LinkAnalysis, UUID> {
    Page<LinkAnalysis> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
    long countByUserId(UUID userId);
    long countByCreatedAtAfter(Instant after);

    @Query("SELECT la.domain, COUNT(la) FROM LinkAnalysis la GROUP BY la.domain ORDER BY COUNT(la) DESC")
    List<Object[]> findMostAnalyzedDomains();

    @Modifying
    @Query("DELETE FROM LinkAnalysis l WHERE l.user.id = :userId")
    void deleteAllByUserId(UUID userId);
}
