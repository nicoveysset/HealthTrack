package com.healthtrack.rdv.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {
    public record ErrorResponse(String error, String message, int statusCode) {}

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException ex) {
        return ResponseEntity.status(ex.getStatusCode())
            .body(new ErrorResponse(ex.getError(), ex.getMessage(), ex.getStatusCode()));
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleVal(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage()).collect(Collectors.joining(", "));
        return ResponseEntity.status(400).body(new ErrorResponse("ValidationError", msg, 400));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGen(Exception ex) {
        return ResponseEntity.status(500).body(new ErrorResponse("InternalServerError", "Une erreur interne est survenue", 500));
    }
}
