package com.nlpreview.analyzer.controller;

import com.nlpreview.analyzer.dto.response.AdminMetricsResponse;
import com.nlpreview.analyzer.dto.response.AdminUserListResponse;
import com.nlpreview.analyzer.dto.response.AdminVisitsResponse;
import com.nlpreview.analyzer.dto.response.PagedResponse;
import com.nlpreview.analyzer.service.AdminService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/metrics")
    public ResponseEntity<AdminMetricsResponse> getMetrics() {
        log.info("Admin metrics requested");
        return ResponseEntity.ok(adminService.getMetrics());
    }

    @GetMapping("/users")
    public ResponseEntity<PagedResponse<AdminUserListResponse>> getUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        log.info("Admin users list requested, page: {}, size: {}", page, size);
        size = Math.min(Math.max(size, 1), 100);
        return ResponseEntity.ok(adminService.getUsers(page, size));
    }

    @GetMapping("/analysis-count")
    public ResponseEntity<Map<String, Long>> getAnalysisCount() {
        log.info("Admin analysis count requested");
        return ResponseEntity.ok(adminService.getAnalysisCount());
    }

    @GetMapping("/visits")
    public ResponseEntity<AdminVisitsResponse> getVisits() {
        log.info("Admin visits requested");
        return ResponseEntity.ok(adminService.getVisits());
    }
}
