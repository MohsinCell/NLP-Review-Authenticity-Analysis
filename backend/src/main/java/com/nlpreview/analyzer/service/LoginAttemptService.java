package com.nlpreview.analyzer.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
@Slf4j
public class LoginAttemptService {

    private final StringRedisTemplate redisTemplate;

    private static final String IP_ATTEMPT_PREFIX = "login:ip:";
    private static final String IP_BLOCK_PREFIX = "block:ip:";

    private static final int MAX_FAILED_ATTEMPTS_PER_IP = 10;
    private static final int IP_BLOCK_DURATION_MINUTES = 10;
    private static final int MAX_FAILED_ATTEMPTS_PER_ACCOUNT = 4;
    private static final int ACCOUNT_LOCK_DURATION_MINUTES = 15;

    public boolean isIpBlocked(String ipAddress) {
        String key = IP_BLOCK_PREFIX + ipAddress;
        Boolean blocked = redisTemplate.hasKey(key);
        return Boolean.TRUE.equals(blocked);
    }

    public void blockIp(String ipAddress) {
        String key = IP_BLOCK_PREFIX + ipAddress;
        redisTemplate.opsForValue().set(key, "1", Duration.ofMinutes(IP_BLOCK_DURATION_MINUTES));
        log.warn("IP address blocked: {} for {} minutes", ipAddress, IP_BLOCK_DURATION_MINUTES);
    }

    public void recordFailedAttempt(String ipAddress) {
        String key = IP_ATTEMPT_PREFIX + ipAddress;
        String attempts = redisTemplate.opsForValue().get(key);
        int currentAttempts = attempts != null ? Integer.parseInt(attempts) : 0;

        currentAttempts++;
        redisTemplate.opsForValue().set(key, String.valueOf(currentAttempts), Duration.ofMinutes(5));

        if (currentAttempts >= MAX_FAILED_ATTEMPTS_PER_IP) {
            blockIp(ipAddress);
            clearFailedAttempts(ipAddress);
            log.warn("IP {} blocked after {} failed attempts", ipAddress, currentAttempts);
        }
    }

    public void clearFailedAttempts(String ipAddress) {
        String key = IP_ATTEMPT_PREFIX + ipAddress;
        redisTemplate.delete(key);
    }

    public void recordSuccessfulLogin(String ipAddress) {
        clearFailedAttempts(ipAddress);
    }

    public int getMaxFailedAttemptsPerAccount() {
        return MAX_FAILED_ATTEMPTS_PER_ACCOUNT;
    }

    public int getAccountLockDurationMinutes() {
        return ACCOUNT_LOCK_DURATION_MINUTES;
    }
}
