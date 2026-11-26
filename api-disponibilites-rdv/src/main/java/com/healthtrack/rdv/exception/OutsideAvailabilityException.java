package com.healthtrack.rdv.exception;

/** HTTP 422 — Le créneau est en dehors des disponibilités du praticien. */
public class OutsideAvailabilityException extends ApiException {
    public static final int STATUS = 422;

    public OutsideAvailabilityException() { this("Le créneau est en dehors des disponibilités du praticien"); }

    public OutsideAvailabilityException(String message) { super("OutsideAvailabilityException", message, STATUS); }
}
