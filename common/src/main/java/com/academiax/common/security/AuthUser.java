package com.academiax.common.security;

import com.academiax.common.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

/** Authenticated principal carried in the JWT. */
public record AuthUser(UUID id, String name, String email, String role) {

    public boolean is(String r) {
        return r.equals(role);
    }

    public static AuthUser current() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a != null && a.getPrincipal() instanceof AuthUser u) return u;
        throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required.");
    }
}
