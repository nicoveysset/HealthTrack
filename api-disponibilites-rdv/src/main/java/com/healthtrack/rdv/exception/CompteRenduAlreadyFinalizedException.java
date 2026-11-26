package com.healthtrack.rdv.exception;

/** HTTP 409 — Le compte rendu est déjà finalisé. */
public class CompteRenduAlreadyFinalizedException extends ApiException {
    public static final int STATUS = 409;

    public CompteRenduAlreadyFinalizedException() { this("Le compte rendu est déjà finalisé"); }

    public CompteRenduAlreadyFinalizedException(String message) { super("CompteRenduAlreadyFinalizedException", message, STATUS); }
}
