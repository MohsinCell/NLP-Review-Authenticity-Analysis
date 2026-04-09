package com.nlpreview.analyzer.config;

import com.nlpreview.analyzer.entity.User;
import com.nlpreview.analyzer.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
@Slf4j
public class AdminInitializer implements ApplicationRunner {

    private final String adminEmail;
    private final String adminPassword;
    private final String adminName;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminInitializer(
            @Value("${app.admin.email}") String adminEmail,
            @Value("${app.admin.password}") String adminPassword,
            @Value("${app.admin.name:ReviewIQ Admin}") String adminName,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder) {
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
        this.adminName = adminName;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (adminEmail == null || adminEmail.isBlank() || adminPassword == null || adminPassword.isBlank()) {
            log.warn("Admin credentials not configured (app.admin.email / app.admin.password). Skipping admin initialization.");
            return;
        }

        List<User> existingAdmins = userRepository.findAllByRole(User.Role.ADMIN);
        for (User admin : existingAdmins) {
            if (!admin.getEmail().equalsIgnoreCase(adminEmail)) {
                log.info("Removing old admin user: {}", admin.getEmail());
                userRepository.delete(admin);
            }
        }

        User admin = userRepository.findByEmail(adminEmail).orElse(null);

        if (admin == null) {
            admin = User.builder()
                    .email(adminEmail)
                    .fullName(adminName)
                    .passwordHash(passwordEncoder.encode(adminPassword))
                    .role(User.Role.ADMIN)
                    .enabled(true)
                    .accountLocked(false)
                    .failedLoginAttempts(0)
                    .build();
            userRepository.save(admin);
            log.info("Admin user created: {}", adminEmail);
        } else {
            admin.setPasswordHash(passwordEncoder.encode(adminPassword));
            admin.setAccountLocked(false);
            admin.setFailedLoginAttempts(0);
            admin.setEnabled(true);
            userRepository.save(admin);
            log.info("Admin user password synced and account unlocked: {}", adminEmail);
        }
    }
}
