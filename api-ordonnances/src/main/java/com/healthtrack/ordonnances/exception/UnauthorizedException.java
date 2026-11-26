package com.healthtrack.ordonnances.exception;

/** HTTP 401 — Authentification requise. */
public class UnauthorizedException extends ApiException {
    public static final int STATUS = 401;

    public UnauthorizedException() { this("Authentification requise"); }

    public UnauthorizedException(String message) { super("UnauthorizedException", message, STATUS); }
}
