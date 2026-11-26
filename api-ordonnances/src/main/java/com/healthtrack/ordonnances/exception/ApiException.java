package com.healthtrack.ordonnances.exception;

/**
 * Exception métier de base : chaque exception nommée du sujet en hérite
 * et porte son code HTTP. Le GlobalExceptionHandler la transforme en réponse JSON
 * { "error": "NomDeLException", "message": "...", "statusCode": 409 }.
 */
public class ApiException extends RuntimeException {
    private final String error;
    private final int statusCode;

    public ApiException(String error, String message, int statusCode) {
        super(message);
        this.error = error;
        this.statusCode = statusCode;
    }

    public String getError() { return error; }
    public int getStatusCode() { return statusCode; }
}
