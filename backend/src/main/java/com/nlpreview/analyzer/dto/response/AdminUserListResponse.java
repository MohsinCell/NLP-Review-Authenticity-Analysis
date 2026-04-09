package com.nlpreview.analyzer.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserListResponse {
    private UUID id;
    private String email;
    private String fullName;
    private String role;
    private boolean enabled;
    private Instant createdAt;
    private long totalAnalyses;
}
