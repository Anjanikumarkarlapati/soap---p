package com.academiax.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

@Component
public class JwtService {

    private static final String ISSUER = "academiax";
    /** Fixed identity used for service-to-service calls to /internal endpoints. */
    public static final UUID SYSTEM_ID = new UUID(0, 0);

    private final SecretKey key;
    private final Duration ttl;

    public JwtService(@Value("${academiax.jwt.secret}") String secret, @Value("${academiax.jwt.ttl:PT60M}") Duration ttl) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) throw new IllegalStateException("JWT_SECRET must be at least 32 bytes");
        this.key = Keys.hmacShaKeyFor(bytes);
        this.ttl = ttl;
    }

    public String issue(AuthUser user) {
        return issue(user, ttl);
    }

    public String systemToken() {
        return issue(new AuthUser(SYSTEM_ID, "system", "system@academiax.internal", "SYSTEM"), Duration.ofMinutes(5));
    }

    public Duration ttl() {
        return ttl;
    }

    private String issue(AuthUser user, Duration lifetime) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(ISSUER)
                .subject(user.id().toString())
                .claim("name", user.name())
                .claim("email", user.email())
                .claim("role", user.role())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(lifetime)))
                .signWith(key)
                .compact();
    }

    /** Empty when the token is malformed, tampered with, expired or from another issuer. */
    public Optional<AuthUser> parse(String token) {
        try {
            Claims c = Jwts.parser().verifyWith(key).requireIssuer(ISSUER).build().parseSignedClaims(token).getPayload();
            return Optional.of(new AuthUser(UUID.fromString(c.getSubject()), c.get("name", String.class), c.get("email", String.class), c.get("role", String.class)));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
