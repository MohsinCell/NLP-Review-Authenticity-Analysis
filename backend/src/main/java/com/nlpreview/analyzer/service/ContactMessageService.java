package com.nlpreview.analyzer.service;

import com.nlpreview.analyzer.dto.request.ContactMessageRequest;
import com.nlpreview.analyzer.dto.response.ContactMessageResponse;
import com.nlpreview.analyzer.entity.ContactMessage;
import com.nlpreview.analyzer.repository.ContactMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContactMessageService {

    private final ContactMessageRepository repository;
    private final EmailService emailService;

    @Transactional
    public ContactMessageResponse submitMessage(ContactMessageRequest request, UUID userId) {
        log.info("Saving new contact message from: {}", request.getEmail());
        ContactMessage message = ContactMessage.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .subject(request.getSubject())
                .message(request.getMessage())
                .userId(userId)
                .build();

        ContactMessage saved = repository.save(message);

        emailService.sendContactConfirmationEmail(
                request.getEmail(),
                request.getFirstName(),
                request.getSubject()
        );

        emailService.sendContactAdminNotification(
                request.getFirstName(),
                request.getLastName(),
                request.getEmail(),
                request.getSubject(),
                request.getMessage()
        );

        return ContactMessageResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<ContactMessageResponse> getAllMessages() {
        return repository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(ContactMessageResponse::fromEntity)
                .collect(Collectors.toList());
    }
}
