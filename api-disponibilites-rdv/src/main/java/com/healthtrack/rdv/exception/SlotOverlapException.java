package com.healthtrack.rdv.exception;

/** HTTP 409 — Les créneaux de disponibilité se chevauchent. */
public class SlotOverlapException extends ApiException {
    public static final int STATUS = 409;

    public SlotOverlapException() { this("Les créneaux de disponibilité se chevauchent"); }

    public SlotOverlapException(String message) { super("SlotOverlapException", message, STATUS); }
}
