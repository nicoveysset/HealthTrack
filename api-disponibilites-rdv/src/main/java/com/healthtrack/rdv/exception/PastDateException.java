package com.healthtrack.rdv.exception;

/** HTTP 422 — La date est dans le passé. */
public class PastDateException extends ApiException {
    public static final int STATUS = 422;

    public PastDateException() { this("La date est dans le passé"); }

    public PastDateException(String message) { super("PastDateException", message, STATUS); }
}
