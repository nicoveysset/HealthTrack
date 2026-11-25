package com.healthtrack.dossiers.exception;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestControllerAdvice
public class GlobalExceptionHandler {
    public record ErrorResponse(String error, String message, int statusCode) {}
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> h(ApiException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(new ErrorResponse(ex.getError(), ex.getMessage(), ex.getStatusCode()));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> g(Exception ex) {
        return ResponseEntity.status(500).body(new ErrorResponse("InternalServerError", "Erreur interne", 500));
    }
}
