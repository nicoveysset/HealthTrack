package com.healthtrack.dossiers.exception;

/** HTTP 409 — Cette allergie est liée à une ordonnance active. */
public class AllergyLinkedToActivePrescriptionException extends ApiException {
    public static final int STATUS = 409;

    public AllergyLinkedToActivePrescriptionException() { this("Cette allergie est liée à une ordonnance active"); }

    public AllergyLinkedToActivePrescriptionException(String message) { super("AllergyLinkedToActivePrescriptionException", message, STATUS); }
}
