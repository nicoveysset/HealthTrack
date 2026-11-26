package com.healthtrack.ordonnances.exception;

/** HTTP 403 — Action non autorisée. */
public class ForbiddenException extends ApiException {
    public static final int STATUS = 403;

    public ForbiddenException() { this("Action non autorisée"); }

    public ForbiddenException(String message) { super("ForbiddenException", message, STATUS); }
}
