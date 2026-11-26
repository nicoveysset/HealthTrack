package com.healthtrack.utilisateurs.exception;

/** HTTP 401 — Email ou mot de passe incorrect. */
public class InvalidCredentialsException extends ApiException {
    public static final int STATUS = 401;

    public InvalidCredentialsException() { this("Email ou mot de passe incorrect"); }

    public InvalidCredentialsException(String message) { super("InvalidCredentialsException", message, STATUS); }
}
