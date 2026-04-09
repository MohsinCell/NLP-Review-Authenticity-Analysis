package com.nlpreview.analyzer.dto.response;

import com.nlpreview.analyzer.entity.ContactMessage;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class ContactMessageResponse {
    private UUID id;
    private String firstName;
    private String lastName;
    private String email;
    private String subject;
    private String message;
    private UUID userId;
    private Instant createdAt;

    public static ContactMessageResponse fromEntity(ContactMessage msg) {
        return ContactMessageResponse.builder()
                .id(msg.getId())
                .firstName(msg.getFirstName())
                .lastName(msg.getLastName())
                .email(msg.getEmail())
                .subject(msg.getSubject())
                .message(msg.getMessage())
                .userId(msg.getUserId())
                .createdAt(msg.getCreatedAt())
                .build();
    }
}
