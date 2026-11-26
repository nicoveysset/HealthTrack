package com.healthtrack.utilisateurs.exception;

/** HTTP 404 — Ressource non trouvée. */
public class NotFoundException extends ApiException {
    public static final int STATUS = 404;

    public NotFoundException() { this("Ressource non trouvée"); }

    public NotFoundException(String message) { super("NotFoundException", message, STATUS); }
}
