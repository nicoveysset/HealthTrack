package com.healthtrack.dossiers.exception;

/** HTTP 409 — Conflit avec l'état actuel de la ressource. */
public class ConflictException extends ApiException {
    public static final int STATUS = 409;

    public ConflictException() { this("Conflit avec l'état actuel de la ressource"); }

    public ConflictException(String message) { super("ConflictException", message, STATUS); }
}
