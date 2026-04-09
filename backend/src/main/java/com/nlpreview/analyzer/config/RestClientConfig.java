package com.nlpreview.analyzer.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class RestClientConfig {

    @Bean(name = "mlRestTemplate")
    public RestTemplate mlRestTemplate(RestTemplateBuilder builder, AppProperties appProperties) {
        return builder
                .setConnectTimeout(Duration.ofMillis(appProperties.getMlService().getTimeoutMs()))
                .setReadTimeout(Duration.ofMillis(appProperties.getMlService().getTimeoutMs()))
                .build();
    }

    @Bean(name = "scraperRestTemplate")
    public RestTemplate scraperRestTemplate(RestTemplateBuilder builder, AppProperties appProperties) {
        return builder
                .setConnectTimeout(Duration.ofMillis(appProperties.getScraperService().getTimeoutMs()))
                .setReadTimeout(Duration.ofMillis(appProperties.getScraperService().getTimeoutMs()))
                .build();
    }
}
