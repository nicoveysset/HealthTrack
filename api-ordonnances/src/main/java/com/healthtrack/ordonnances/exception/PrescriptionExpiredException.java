package com.healthtrack.ordonnances.exception;

/** HTTP 409 — L'ordonnance est expirée et ne peut plus être modifiée. */
public class PrescriptionExpiredException extends ApiException {
    public static final int STATUS = 409;

    public PrescriptionExpiredException() { this("L'ordonnance est expirée et ne peut plus être modifiée"); }

    public PrescriptionExpiredException(String message) { super("PrescriptionExpiredException", message, STATUS); }
}
