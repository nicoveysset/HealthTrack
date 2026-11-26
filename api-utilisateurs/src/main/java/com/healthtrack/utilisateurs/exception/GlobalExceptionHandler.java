package com.healthtrack.utilisateurs.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.stream.Collectors;

/**
 * Transforme toutes les erreurs en réponse JSON homogène.
 * Les erreurs métier sont loggées en WARN, les erreurs inattendues en ERROR (visibles dans CloudWatch).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    public record ErrorResponse(String error, String message, int statusCode, String path, String timestamp) {}

    private ResponseEntity<ErrorResponse> build(String error, String message, int status, HttpServletRequest req) {
        return ResponseEntity.status(status)
            .body(new ErrorResponse(error, message, status, req.getRequestURI(), Instant.now().toString()));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException ex, HttpServletRequest req) {
        log.warn("{\"event\":\"BUSINESS_ERROR\",\"error\":\"{}\",\"status\":{},\"method\":\"{}\",\"path\":\"{}\",\"message\":\"{}\"}",
            ex.getError(), ex.getStatusCode(), req.getMethod(), req.getRequestURI(), ex.getMessage());
        return build(ex.getError(), ex.getMessage(), ex.getStatusCode(), req);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + " : " + e.getDefaultMessage())
            .collect(Collectors.joining(", "));
        return build("ValidationException", message, 400, req);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, DateTimeParseException.class,
                       MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class,
                       IllegalArgumentException.class})
    public ResponseEntity<ErrorResponse> handleBadRequest(Exception ex, HttpServletRequest req) {
        String message = switch (ex) {
            case HttpMessageNotReadableException e -> "Corps de requête JSON invalide";
            case DateTimeParseException e -> "Date ou heure invalide : " + e.getParsedString();
            case MethodArgumentTypeMismatchException e -> "Paramètre invalide : " + e.getName();
            case MissingServletRequestParameterException e -> "Paramètre requis manquant : " + e.getParameterName();
            default -> ex.getMessage();
        };
        return build("ValidationException", message, 400, req);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoRoute(NoResourceFoundException ex, HttpServletRequest req) {
        return build("NotFoundException", "Route inexistante", 404, req);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethod(HttpRequestMethodNotSupportedException ex, HttpServletRequest req) {
        return build("MethodNotAllowed", "Méthode " + ex.getMethod() + " non supportée sur cette route", 405, req);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex, HttpServletRequest req) {
        log.error("{\"event\":\"UNEXPECTED_ERROR\",\"method\":\"{}\",\"path\":\"{}\"}", req.getMethod(), req.getRequestURI(), ex);
        return build("InternalServerError", "Une erreur interne est survenue", 500, req);
    }
}
