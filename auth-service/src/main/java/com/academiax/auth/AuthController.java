package com.academiax.auth;

import com.academiax.common.audit.AuditEvent;
import com.academiax.common.audit.AuditService;
import com.academiax.common.security.AuthUser;
import com.academiax.common.security.JwtService;
import com.academiax.common.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
public class AuthController {

    public record LoginRequest(@NotBlank @Email @Size(max = 254) String email, @NotBlank @Size(max = 128) String password) {}
    public record UserDto(UUID id, String name, String email, String role, String status, Instant createdAt) {
        static UserDto of(User u) { return new UserDto(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.getStatus(), u.getCreatedAt()); }
    }
    public record LoginResponse(String accessToken, String tokenType, long expiresIn, UserDto user) {}
    public record StatusRequest(@NotBlank @Pattern(regexp = "ACTIVE|SUSPENDED") String status) {}

    private final UserRepository users;
    private final JwtService jwt;
    private final AuditService audit;
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    // Burns comparable time when the email doesn't exist, so response time doesn't reveal valid accounts.
    private final String dummyHash = encoder.encode("timing-equalizer");
    private final int maxFailures;
    private final Duration window;
    // ponytail: per-instance in-memory limiter; move to Redis/gateway RequestRateLimiter when auth runs >1 replica.
    private final ConcurrentHashMap<String, Attempts> failures = new ConcurrentHashMap<>();

    private record Attempts(int count, Instant since) {}

    public AuthController(UserRepository users, JwtService jwt, AuditService audit,
                          @Value("${academiax.login.max-failures:5}") int maxFailures,
                          @Value("${academiax.login.window:PT15M}") Duration window) {
        this.users = users;
        this.jwt = jwt;
        this.audit = audit;
        this.maxFailures = maxFailures;
        this.window = window;
    }

    PasswordEncoder encoder() {
        return encoder;
    }

    // Not @Transactional: a rejected login must still persist its LOGIN_FAILED audit row.
    @PostMapping("/api/auth/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req, HttpServletRequest http) {
        String key = req.email().toLowerCase() + "|" + clientIp(http);
        Attempts a = failures.get(key);
        if (a != null && a.since().plus(window).isAfter(Instant.now()) && a.count() >= maxFailures) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many sign-in attempts. Try again in a few minutes.");
        }

        var user = users.findByEmail(req.email());
        boolean ok = encoder.matches(req.password(), user.map(User::getPasswordHash).orElse(dummyHash)) && user.isPresent();
        if (!ok) {
            failures.merge(key, new Attempts(1, Instant.now()), (old, n) ->
                    old.since().plus(window).isBefore(Instant.now()) ? n : new Attempts(old.count() + 1, old.since()));
            audit.record("LOGIN_FAILED", "user", user.map(u -> u.getId().toString()).orElse("unknown"));
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
        }
        failures.remove(key);
        User u = user.get();
        MDC.put("actorId", u.getId().toString());
        if (!"ACTIVE".equals(u.getStatus())) {
            audit.record("LOGIN_BLOCKED_SUSPENDED", "user", u.getId());
            throw new ApiException(HttpStatus.FORBIDDEN, "This account is suspended. Contact the registrar.");
        }
        audit.record("LOGIN_SUCCEEDED", "user", u.getId());
        String token = jwt.issue(new AuthUser(u.getId(), u.getName(), u.getEmail(), u.getRole()));
        return new LoginResponse(token, "Bearer", jwt.ttl().toSeconds(), UserDto.of(u));
    }

    @GetMapping("/api/users/me")
    public UserDto me() {
        return users.findById(AuthUser.current().id()).map(UserDto::of).orElseThrow(() -> ApiException.notFound("User"));
    }

    @GetMapping("/api/users")
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserDto> list() {
        return users.findAllByOrderByCreatedAtDesc().stream().map(UserDto::of).toList();
    }

    /** Instructor picker for course forms. */
    @GetMapping("/api/users/instructors")
    @PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
    public List<UserDto> instructors() {
        return users.findByRoleOrderByName("INSTRUCTOR").stream().map(UserDto::of).toList();
    }

    @PatchMapping("/api/users/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public UserDto setStatus(@PathVariable UUID id, @Valid @RequestBody StatusRequest req) {
        if (id.equals(AuthUser.current().id())) throw ApiException.unprocessable("You can't change your own account status.");
        User u = users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
        u.setStatus(req.status());
        audit.record("USER_" + req.status(), "user", id);
        return UserDto.of(u);
    }

    @GetMapping("/api/users/audit")
    @PreAuthorize("hasRole('ADMIN')")
    public List<AuditEvent> auditLog(@RequestParam(defaultValue = "50") int size) {
        return audit.recent(size).getContent();
    }

    @GetMapping("/internal/users/{id}")
    public UserDto internalUser(@PathVariable UUID id) {
        return users.findById(id).map(UserDto::of).orElseThrow(() -> ApiException.notFound("User"));
    }

    private static String clientIp(HttpServletRequest http) {
        String fwd = http.getHeader("X-Forwarded-For"); // set by the gateway
        return fwd != null ? fwd.split(",")[0].trim() : http.getRemoteAddr();
    }
}
