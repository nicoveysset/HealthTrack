package com.healthtrack.ordonnances.exception;

/** HTTP 409 — Le patient est allergique à ce médicament. */
public class AllergyConflictException extends ApiException {
    public static final int STATUS = 409;

    public AllergyConflictException() { this("Le patient est allergique à ce médicament"); }

    public AllergyConflictException(String message) { super("AllergyConflictException", message, STATUS); }
}
