package com.academiax.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

/**
 * Every service validates the JWT itself (PRD §12: authorization is enforced inside each
 * service, not only at the gateway). Role checks live on controllers via @PreAuthorize.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwt,
                                            @Value("${academiax.security.public-paths:}") String[] publicPaths) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable) // CORS is handled once, at the gateway
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> {
                    a.requestMatchers("/actuator/health/**", "/actuator/info", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/error").permitAll();
                    if (publicPaths.length > 0) a.requestMatchers(publicPaths).permitAll();
                    a.requestMatchers("/internal/**").hasRole("SYSTEM");
                    a.anyRequest().authenticated();
                })
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> writeError(res, 401, "Unauthorized", "Missing, invalid or expired token."))
                        .accessDeniedHandler((req, res, ex) -> writeError(res, 403, "Forbidden", "You don't have permission for this action.")))
                .addFilterBefore(new JwtFilter(jwt), UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    static void writeError(HttpServletResponse res, int status, String error, String message) throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        res.getWriter().write("{\"status\":%d,\"error\":\"%s\",\"message\":\"%s\",\"correlationId\":\"%s\",\"timestamp\":\"%s\"}"
                .formatted(status, error, message, MDC.get("correlationId"), Instant.now()));
    }

    static final class JwtFilter extends OncePerRequestFilter {
        private final JwtService jwt;

        JwtFilter(JwtService jwt) {
            this.jwt = jwt;
        }

        @Override
        protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
            String header = req.getHeader(HttpHeaders.AUTHORIZATION);
            if (header != null && header.startsWith("Bearer ")) {
                jwt.parse(header.substring(7)).ifPresent(u -> {
                    var auth = new UsernamePasswordAuthenticationToken(u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.role())));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    MDC.put("actorId", u.id().toString());
                });
            }
            try {
                chain.doFilter(req, res);
            } finally {
                MDC.remove("actorId");
            }
        }
    }
}
