package com.healthtrack.rdv.exception;

/** HTTP 409 — Annulation impossible moins de 2h avant le rendez-vous. */
public class CancellationTooLateException extends ApiException {
    public static final int STATUS = 409;

    public CancellationTooLateException() { this("Annulation impossible moins de 2h avant le rendez-vous"); }

    public CancellationTooLateException(String message) { super("CancellationTooLateException", message, STATUS); }
}
