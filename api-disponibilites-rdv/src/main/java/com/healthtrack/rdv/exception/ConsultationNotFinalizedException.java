package com.healthtrack.rdv.exception;

/** HTTP 409 — La consultation n'est pas terminée. */
public class ConsultationNotFinalizedException extends ApiException {
    public static final int STATUS = 409;

    public ConsultationNotFinalizedException() { this("La consultation n'est pas terminée"); }

    public ConsultationNotFinalizedException(String message) { super("ConsultationNotFinalizedException", message, STATUS); }
}
