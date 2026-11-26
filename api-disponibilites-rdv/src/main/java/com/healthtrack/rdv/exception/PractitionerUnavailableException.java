package com.healthtrack.rdv.exception;

/** HTTP 409 — Le praticien est indisponible sur cette période. */
public class PractitionerUnavailableException extends ApiException {
    public static final int STATUS = 409;

    public PractitionerUnavailableException() { this("Le praticien est indisponible sur cette période"); }

    public PractitionerUnavailableException(String message) { super("PractitionerUnavailableException", message, STATUS); }
}
