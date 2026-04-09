package com.nlpreview.analyzer.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LinkAnalysisRequest {

    @NotBlank(message = "Product URL is required")
    @Pattern(regexp = "^https?://.*", message = "URL must start with http:// or https://")
    private String productUrl;
}
