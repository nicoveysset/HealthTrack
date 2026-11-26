package com.healthtrack.ordonnances.exception;

/** HTTP 409 — Le rendez-vous n'est pas TERMINE ou son compte rendu n'est pas finalisé. */
public class ConsultationNotFinalizedException extends ApiException {
    public static final int STATUS = 409;

    public ConsultationNotFinalizedException() { this("Le rendez-vous n'est pas TERMINE ou son compte rendu n'est pas finalisé"); }

    public ConsultationNotFinalizedException(String message) { super("ConsultationNotFinalizedException", message, STATUS); }
}
