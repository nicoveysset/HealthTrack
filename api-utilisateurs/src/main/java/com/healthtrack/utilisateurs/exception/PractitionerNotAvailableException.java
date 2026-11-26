package com.healthtrack.utilisateurs.exception;

/** HTTP 409 — Le praticien n'est pas disponible. */
public class PractitionerNotAvailableException extends ApiException {
    public static final int STATUS = 409;

    public PractitionerNotAvailableException() { this("Le praticien n'est pas disponible"); }

    public PractitionerNotAvailableException(String message) { super("PractitionerNotAvailableException", message, STATUS); }
}
