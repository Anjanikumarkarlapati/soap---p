package com.academiax.common.security;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-42";
    private final JwtService jwt = new JwtService(SECRET, Duration.ofMinutes(5));
    private final AuthUser student = new AuthUser(UUID.randomUUID(), "Priya", "student@academiax.edu", "STUDENT");

    @Test
    void roundTripsIdentityAndRole() {
        assertThat(jwt.parse(jwt.issue(student))).contains(student);
    }

    @Test
    void rejectsTamperedPayload() {
        String[] parts = jwt.issue(student).split("\\.");
        String forged = new String(java.util.Base64.getUrlDecoder().decode(parts[1])).replace("STUDENT", "ADMIN");
        String token = parts[0] + "." + java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(forged.getBytes()) + "." + parts[2];
        assertThat(jwt.parse(token)).isEmpty();
    }

    @Test
    void rejectsTokenSignedWithAnotherKey() {
        var other = new JwtService("another-secret-another-secret-another-1", Duration.ofMinutes(5));
        assertThat(jwt.parse(other.issue(student))).isEmpty();
    }

    @Test
    void rejectsExpiredToken() {
        var expired = new JwtService(SECRET, Duration.ofSeconds(-1));
        assertThat(jwt.parse(expired.issue(student))).isEmpty();
    }

    @Test
    void refusesWeakSecret() {
        assertThatThrownBy(() -> new JwtService("short", Duration.ofMinutes(5))).isInstanceOf(IllegalStateException.class);
    }
}
