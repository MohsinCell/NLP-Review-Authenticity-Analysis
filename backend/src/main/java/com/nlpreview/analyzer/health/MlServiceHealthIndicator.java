package com.nlpreview.analyzer.health;

import com.nlpreview.analyzer.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component("mlService")
@RequiredArgsConstructor
@Slf4j
public class MlServiceHealthIndicator implements HealthIndicator {

    private final AppProperties appProperties;

    @Override
    public Health health() {
        try {
            String url = appProperties.getMlService().getBaseUrl() + "/health";
            RestTemplate restTemplate = new RestTemplate();
            restTemplate.getForEntity(url, String.class);
            return Health.up()
                    .withDetail("url", appProperties.getMlService().getBaseUrl())
                    .build();
        } catch (Exception e) {
            return Health.down()
                    .withDetail("url", appProperties.getMlService().getBaseUrl())
                    .withDetail("error", e.getMessage())
                    .build();
        }
    }
}
