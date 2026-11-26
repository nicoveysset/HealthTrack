package com.healthtrack.rdv.exception;

/** HTTP 409 — Ce créneau est déjà occupé. */
public class SlotAlreadyTakenException extends ApiException {
    public static final int STATUS = 409;

    public SlotAlreadyTakenException() { this("Ce créneau est déjà occupé"); }

    public SlotAlreadyTakenException(String message) { super("SlotAlreadyTakenException", message, STATUS); }
}
