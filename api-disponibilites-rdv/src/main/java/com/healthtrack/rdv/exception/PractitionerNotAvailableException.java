package com.healthtrack.rdv.exception;

/** HTTP 409 — Le praticien est en congé ou inactif. */
public class PractitionerNotAvailableException extends ApiException {
    public static final int STATUS = 409;

    public PractitionerNotAvailableException() { this("Le praticien est en congé ou inactif"); }

    public PractitionerNotAvailableException(String message) { super("PractitionerNotAvailableException", message, STATUS); }
}
