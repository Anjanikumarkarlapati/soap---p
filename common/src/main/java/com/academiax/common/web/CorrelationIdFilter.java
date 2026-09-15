package com.academiax.common.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

/** Propagates X-Correlation-Id (set by the gateway) into logs, audit rows and downstream calls. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Correlation-Id";
    private static final Pattern SAFE = Pattern.compile("[A-Za-z0-9-]{8,64}");

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String id = req.getHeader(HEADER);
        if (id == null || !SAFE.matcher(id).matches()) id = UUID.randomUUID().toString(); // don't log untrusted junk
        MDC.put("correlationId", id);
        res.setHeader(HEADER, id);
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.remove("correlationId");
        }
    }
}
