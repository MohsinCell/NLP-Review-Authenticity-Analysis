package com.nlpreview.analyzer.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;

@Service
@Slf4j
public class TranslationService {

    private final WebClient webClient;
    private static final String MYMEMORY_URL = "https://api.mymemory.translated.net";
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(8);

    public TranslationService() {
        this.webClient = WebClient.builder()
                .baseUrl(MYMEMORY_URL)
                .build();
    }

    public String translateToEnglish(String text, String sourceLanguageCode) {
        if (text == null || text.trim().isEmpty()) {
            log.warn("Empty text provided for translation");
            return text;
        }

        if ("en".equalsIgnoreCase(sourceLanguageCode) || "english".equalsIgnoreCase(sourceLanguageCode)) {
            log.debug("Text is already in English, skipping translation");
            return text;
        }

        try {
            log.info("Translating text ({} chars) from '{}' to English...", text.length(), sourceLanguageCode);

            String langPair = sourceLanguageCode + "|en";

            String translatedText = webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/get")
                            .queryParam("q", text)
                            .queryParam("langpair", langPair)
                            .build())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(REQUEST_TIMEOUT)
                    .map(response -> {
                        if (response.containsKey("responseStatus") && (int) response.get("responseStatus") == 200) {
                            Map<String, Object> responseData = (Map<String, Object>) response.get("responseData");
                            if (responseData != null && responseData.containsKey("translatedText")) {
                                String result = (String) responseData.get("translatedText");
                                log.info("Translation successful. Original length: {}, Translated length: {}",
                                        text.length(), result.length());
                                return result;
                            }
                        }
                        log.warn("Translation response unexpected format");
                        return text;
                    })
                    .onErrorResume(e -> {
                        log.error("Translation failed: {}", e.getMessage());
                        return Mono.just(text);
                    })
                    .block();

            return translatedText != null ? translatedText : text;

        } catch (Exception e) {
            log.error("Translation error for language {}: {}", sourceLanguageCode, e.getMessage());
            return text;
        }
    }

    public boolean isServiceAvailable() {
        try {
            webClient.get()
                    .uri("/get?q=test&langpair=en|es")
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(5))
                    .block();
            return true;
        } catch (Exception e) {
            log.warn("MyMemory translation service is not available: {}", e.getMessage());
            return false;
        }
    }
}
