package com.healthtrack.ordonnances.exception;

/** HTTP 403 — Accès refusé : aucune consultation antérieure avec ce patient. */
public class AccessDeniedException extends ApiException {
    public static final int STATUS = 403;

    public AccessDeniedException() { this("Accès refusé : aucune consultation antérieure avec ce patient"); }

    public AccessDeniedException(String message) { super("AccessDeniedException", message, STATUS); }
}
