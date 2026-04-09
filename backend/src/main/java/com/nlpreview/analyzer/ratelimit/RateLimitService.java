package com.nlpreview.analyzer.ratelimit;

import com.nlpreview.analyzer.config.AppProperties;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class RateLimitService {

    private final AppProperties appProperties;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public Bucket resolveBucket(String key, boolean authenticated) {
        return buckets.computeIfAbsent(key, k -> createBucket(authenticated));
    }

    public boolean tryConsume(String key, boolean authenticated) {
        Bucket bucket = resolveBucket(key, authenticated);
        boolean consumed = bucket.tryConsume(1);
        if (!consumed) {
            log.warn("Rate limit exceeded for key: {} (authenticated={})", key, authenticated);
        }
        return consumed;
    }

    private Bucket createBucket(boolean authenticated) {
        int requestsPerMinute = authenticated
                ? appProperties.getRateLimit().getAuthenticatedRequestsPerMinute()
                : appProperties.getRateLimit().getAnonymousRequestsPerMinute();

        Bandwidth limit = Bandwidth.classic(
                requestsPerMinute,
                Refill.greedy(requestsPerMinute, Duration.ofMinutes(1))
        );

        return Bucket.builder().addLimit(limit).build();
    }
}
