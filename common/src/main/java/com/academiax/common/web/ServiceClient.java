package com.academiax.common.web;

import com.academiax.common.security.JwtService;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service-to-service REST via Eureka service IDs (e.g. http://COURSE-SERVICE/...), load balanced
 * by Spring Cloud LoadBalancer. Calls carry a short-lived SYSTEM token and the correlation ID,
 * have timeouts, and downstream 4xx errors are re-thrown with their original status and message.
 */
@Component
public class ServiceClient {

    private static final Pattern MESSAGE = Pattern.compile("\"message\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");
    private final RestClient rest;
    private final JwtService jwt;

    public ServiceClient(@LoadBalanced RestClient.Builder builder, JwtService jwt) {
        this.jwt = jwt;
        this.rest = builder
                .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
                    String body = new String(res.getBody().readAllBytes(), StandardCharsets.UTF_8);
                    Matcher m = MESSAGE.matcher(body);
                    HttpStatus status = HttpStatus.resolve(res.getStatusCode().value());
                    if (status == null || status.is5xxServerError()) {
                        throw new ResourceAccessException("Downstream " + req.getURI().getHost() + " returned " + res.getStatusCode());
                    }
                    throw new ApiException(status, m.find() ? m.group(1) : status.getReasonPhrase());
                })
                .build();
    }

    public <T> T get(String url, Class<T> type) {
        // GET is idempotent: one bounded retry on connection failure / 5xx.
        try {
            return call(url, type);
        } catch (ResourceAccessException first) {
            return call(url, type);
        }
    }

    private <T> T call(String url, Class<T> type) {
        return rest.get().uri(url).headers(this::headers).retrieve().body(type);
    }

    /** POST is not retried automatically: callers own idempotency for state-changing calls. */
    public <T> T post(String url, Object body, Class<T> type) {
        var spec = rest.post().uri(url).headers(this::headers);
        if (body != null) spec.body(body);
        return spec.retrieve().body(type);
    }

    private void headers(HttpHeaders h) {
        h.setBearerAuth(jwt.systemToken());
        String cid = MDC.get("correlationId");
        if (cid != null) h.set(CorrelationIdFilter.HEADER, cid);
    }

    @Configuration
    static class ClientConfig {
        /**
         * Plain builder for everything else (notably the Eureka client's own registry calls, which
         * must hit http://localhost:8761 directly). Without it the load-balanced builder below would be
         * the only RestClient.Builder bean, and Eureka would try to resolve "localhost" as a service ID.
         */
        @Bean
        @Primary
        RestClient.Builder restClientBuilder() {
            return RestClient.builder();
        }

        @Bean
        @LoadBalanced
        RestClient.Builder loadBalancedRestClientBuilder(@Value("${academiax.client.connect-timeout:PT2S}") Duration connect,
                                                         @Value("${academiax.client.read-timeout:PT5S}") Duration read) {
            var factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(connect);
            factory.setReadTimeout(read);
            return RestClient.builder().requestFactory(factory);
        }
    }
}
