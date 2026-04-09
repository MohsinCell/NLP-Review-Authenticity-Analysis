package com.nlpreview.analyzer.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewAnalysisRequest {

    @NotBlank(message = "Review text is required")
    @Size(min = 10, max = 5000, message = "Review text must be between 10 and 5000 characters")
    private String reviewText;
}
