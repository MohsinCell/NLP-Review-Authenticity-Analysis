package com.nlpreview.analyzer.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
@Slf4j
public class LanguageDetector {

    private static final Pattern DEVANAGARI_PATTERN = Pattern.compile("[\\u0900-\\u097F]");
    private static final Pattern CYRILLIC_PATTERN = Pattern.compile("[\\u0400-\\u04FF]");
    private static final Pattern CHINESE_PATTERN = Pattern.compile("[\\u4E00-\\u9FFF]");
    private static final Pattern JAPANESE_PATTERN = Pattern.compile("[\\u3040-\\u309F\\u30A0-\\u30FF]");
    private static final Pattern KOREAN_PATTERN = Pattern.compile("[\\uAC00-\\uD7AF\\u1100-\\u11FF]");
    private static final Pattern ARABIC_PATTERN = Pattern.compile("[\\u0600-\\u06FF]");

    public String detectLanguage(String text) {
        if (text == null || text.isBlank()) {
            return "en";
        }

        long totalChars = text.codePoints().filter(Character::isLetter).count();
        if (totalChars == 0) {
            return "en";
        }

        long devanagariChars = countMatches(text, DEVANAGARI_PATTERN);
        long cyrillicChars = countMatches(text, CYRILLIC_PATTERN);
        long chineseChars = countMatches(text, CHINESE_PATTERN);
        long japaneseChars = countMatches(text, JAPANESE_PATTERN);
        long koreanChars = countMatches(text, KOREAN_PATTERN);
        long arabicChars = countMatches(text, ARABIC_PATTERN);

        double devanagariRatio = (double) devanagariChars / totalChars;
        double cyrillicRatio = (double) cyrillicChars / totalChars;
        double chineseRatio = (double) chineseChars / totalChars;
        double japaneseRatio = (double) japaneseChars / totalChars;
        double koreanRatio = (double) koreanChars / totalChars;
        double arabicRatio = (double) arabicChars / totalChars;

        if (devanagariRatio > 0.5) {
            return "hi";
        }

        if (cyrillicRatio > 0.5) {
            return "ru";
        }

        if (chineseRatio > 0.5) {
            return "zh";
        }

        if (japaneseRatio > 0.5) {
            return "ja";
        }

        if (koreanRatio > 0.5) {
            return "ko";
        }

        if (arabicRatio > 0.5) {
            return "ar";
        }

        return "en";
    }

    private long countMatches(String text, Pattern pattern) {
        return pattern.matcher(text).results().count();
    }
}
