package com.healthtrack.utilisateurs.exception;

/** HTTP 409 — Un utilisateur avec cet email existe déjà. */
public class EmailAlreadyUsedException extends ApiException {
    public static final int STATUS = 409;

    public EmailAlreadyUsedException() { this("Un utilisateur avec cet email existe déjà"); }

    public EmailAlreadyUsedException(String message) { super("EmailAlreadyUsedException", message, STATUS); }
}
