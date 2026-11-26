package com.healthtrack.utilisateurs.exception;

/** HTTP 422 — Le médecin traitant doit être un généraliste. */
public class InvalidSpecialityException extends ApiException {
    public static final int STATUS = 422;

    public InvalidSpecialityException() { this("Le médecin traitant doit être un généraliste"); }

    public InvalidSpecialityException(String message) { super("InvalidSpecialityException", message, STATUS); }
}
