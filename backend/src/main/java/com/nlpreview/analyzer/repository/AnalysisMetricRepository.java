package com.nlpreview.analyzer.repository;

import com.nlpreview.analyzer.entity.AnalysisMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface AnalysisMetricRepository extends JpaRepository<AnalysisMetric, UUID> {

    long countByAnalysisType(AnalysisMetric.AnalysisType type);
    long countByAuthenticatedTrue();
    long countByAuthenticatedFalse();
    long countByCreatedAtAfter(Instant after);

    @Query("SELECT am.detectedLanguage, COUNT(am) FROM AnalysisMetric am WHERE am.detectedLanguage IS NOT NULL GROUP BY am.detectedLanguage ORDER BY COUNT(am) DESC")
    List<Object[]> findLanguageDistribution();

    @Query("SELECT am.domain, COUNT(am) FROM AnalysisMetric am WHERE am.domain IS NOT NULL GROUP BY am.domain ORDER BY COUNT(am) DESC")
    List<Object[]> findDomainDistribution();
}
