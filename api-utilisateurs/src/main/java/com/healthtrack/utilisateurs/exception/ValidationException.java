package com.healthtrack.utilisateurs.exception;

/** HTTP 400 — Données invalides. */
public class ValidationException extends ApiException {
    public static final int STATUS = 400;

    public ValidationException() { this("Données invalides"); }

    public ValidationException(String message) { super("ValidationException", message, STATUS); }
}
