package com.nlpreview.analyzer.controller;

import com.nlpreview.analyzer.dto.response.ContactMessageResponse;
import com.nlpreview.analyzer.service.ContactMessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/admin/contact-messages")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class AdminContactController {

    private final ContactMessageService contactMessageService;

    @GetMapping
    public ResponseEntity<List<ContactMessageResponse>> getAllMessages() {
        log.info("Admin fetching all contact messages");
        List<ContactMessageResponse> messages = contactMessageService.getAllMessages();
        return ResponseEntity.ok(messages);
    }
}
