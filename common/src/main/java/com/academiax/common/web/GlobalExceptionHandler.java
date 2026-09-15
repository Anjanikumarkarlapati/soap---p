package com.academiax.common.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    public record ApiError(int status, String error, String message, String correlationId, Instant timestamp) {}

    static ResponseEntity<ApiError> body(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(new ApiError(status.value(), status.getReasonPhrase(), message, MDC.get("correlationId"), Instant.now()));
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> api(ApiException e) {
        return body(e.status(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> invalid(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage()).collect(Collectors.joining("; "));
        return body(HttpStatus.BAD_REQUEST, msg.isEmpty() ? "Invalid request." : msg);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingRequestHeaderException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ApiError> badRequest(Exception e) {
        String msg = e instanceof MissingRequestHeaderException m ? "Missing required header: " + m.getHeaderName() : "Malformed request.";
        return body(HttpStatus.BAD_REQUEST, msg);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> denied() {
        return body(HttpStatus.FORBIDDEN, "You don't have permission for this action.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> integrity(DataIntegrityViolationException e) {
        log.warn("Constraint violation: {}", e.getMostSpecificCause().getMessage());
        return body(HttpStatus.CONFLICT, "The request conflicts with existing data.");
    }

    @ExceptionHandler(org.springframework.orm.ObjectOptimisticLockingFailureException.class)
    ResponseEntity<ApiError> staleWrite() {
        return body(HttpStatus.CONFLICT, "This record was changed by someone else. Reload and try again.");
    }

    @ExceptionHandler(ResourceAccessException.class)
    ResponseEntity<ApiError> downstream(ResourceAccessException e) {
        log.error("Downstream service unavailable: {}", e.getMessage());
        return body(HttpStatus.SERVICE_UNAVAILABLE, "A required service is temporarily unavailable. Please retry.");
    }

    @ExceptionHandler({NoResourceFoundException.class})
    ResponseEntity<ApiError> noRoute() {
        return body(HttpStatus.NOT_FOUND, "Resource not found.");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiError> method() {
        return body(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed.");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception e) {
        log.error("Unhandled error", e);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong. Please try again later.");
    }
}
