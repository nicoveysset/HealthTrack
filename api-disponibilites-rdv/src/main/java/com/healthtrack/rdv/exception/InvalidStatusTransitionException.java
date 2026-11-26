package com.healthtrack.rdv.exception;

/** HTTP 409 — Transition de statut impossible. */
public class InvalidStatusTransitionException extends ApiException {
    public static final int STATUS = 409;

    public InvalidStatusTransitionException() { this("Transition de statut impossible"); }

    public InvalidStatusTransitionException(String message) { super("InvalidStatusTransitionException", message, STATUS); }
}
