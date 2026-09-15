package com.academiax.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.UUID;

/**
 * Seeds the demo accounts shown on the login page (password "password123").
 * IDs are fixed because course-service seed data references the instructors.
 * Disable in production with SEED_DEMO_DATA=false.
 */
@Configuration
@ConditionalOnProperty(name = "academiax.seed-demo-data", havingValue = "true")
class DemoUsers {

    private static final Logger log = LoggerFactory.getLogger(DemoUsers.class);

    @Bean
    ApplicationRunner seedUsers(UserRepository repo, AuthController auth) {
        return args -> {
            if (repo.count() > 0) return;
            String hash = auth.encoder().encode("password123");
            repo.saveAll(List.of(
                    new User(UUID.fromString("11111111-1111-1111-1111-000000000001"), "Priya Sharma", "student@academiax.edu", hash, "STUDENT", "ACTIVE"),
                    new User(UUID.fromString("11111111-1111-1111-1111-000000000002"), "Daniel Okafor", "daniel@academiax.edu", hash, "STUDENT", "ACTIVE"),
                    new User(UUID.fromString("11111111-1111-1111-1111-000000000003"), "Mei Lin", "mei@academiax.edu", hash, "STUDENT", "SUSPENDED"),
                    new User(UUID.fromString("22222222-2222-2222-2222-000000000001"), "Dr. Alan Reyes", "instructor@academiax.edu", hash, "INSTRUCTOR", "ACTIVE"),
                    new User(UUID.fromString("22222222-2222-2222-2222-000000000002"), "Prof. Sara Nguyen", "sara@academiax.edu", hash, "INSTRUCTOR", "ACTIVE"),
                    new User(UUID.fromString("33333333-3333-3333-3333-000000000001"), "Jordan Blake", "admin@academiax.edu", hash, "ADMIN", "ACTIVE")));
            log.info("Seeded 6 demo users");
        };
    }
}
