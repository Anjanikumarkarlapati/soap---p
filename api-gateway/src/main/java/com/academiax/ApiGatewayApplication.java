package com.academiax;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

import java.util.UUID;
import java.util.regex.Pattern;

@SpringBootApplication
public class ApiGatewayApplication {

    private static final Logger log = LoggerFactory.getLogger("GATEWAY");
    private static final String HEADER = "X-Correlation-Id";
    private static final Pattern SAFE = Pattern.compile("[A-Za-z0-9-]{8,64}");

    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }

    /** Assigns a correlation ID to every request entering the platform and echoes it back. */
    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    GlobalFilter correlationIdFilter() {
        return (exchange, chain) -> {
            String incoming = exchange.getRequest().getHeaders().getFirst(HEADER);
            String id = incoming != null && SAFE.matcher(incoming).matches() ? incoming : UUID.randomUUID().toString();
            var request = exchange.getRequest().mutate().headers(h -> h.set(HEADER, id)).build();
            exchange.getResponse().getHeaders().set(HEADER, id);
            long start = System.nanoTime();
            return chain.filter(exchange.mutate().request(request).build())
                    .doFinally(s -> log.info("{} {} -> {} in {}ms correlationId={}", request.getMethod(), request.getPath(),
                            exchange.getResponse().getStatusCode(), (System.nanoTime() - start) / 1_000_000, id));
        };
    }
}
