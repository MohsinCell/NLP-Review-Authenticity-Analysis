package com.nlpreview.analyzer.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RedFlagsResponse {
    private List<RedFlag> redFlags;
    private int totalFlags;
    private String suspicionLevel;
    private int score;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RedFlag {
        private String type;
        private String severity;
        private String description;
        private String evidence;
    }
}
