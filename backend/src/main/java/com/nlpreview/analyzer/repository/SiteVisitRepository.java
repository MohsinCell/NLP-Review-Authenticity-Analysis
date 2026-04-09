package com.nlpreview.analyzer.repository;

import com.nlpreview.analyzer.entity.SiteVisit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface SiteVisitRepository extends JpaRepository<SiteVisit, UUID> {
    long countByCreatedAtAfter(Instant after);
    long countByAuthenticatedTrue();
    long countByAuthenticatedFalse();

    @Query("SELECT COUNT(sv) FROM SiteVisit sv WHERE sv.createdAt >= :since")
    long countVisitsSince(@Param("since") Instant since);

    @Query("SELECT COUNT(DISTINCT sv.ipAddress) FROM SiteVisit sv WHERE sv.createdAt >= :since")
    long countUniqueVisitorsSince(@Param("since") Instant since);
}
