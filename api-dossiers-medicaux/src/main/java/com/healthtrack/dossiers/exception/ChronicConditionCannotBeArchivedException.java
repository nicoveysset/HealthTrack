package com.healthtrack.dossiers.exception;

/** HTTP 409 — Un antécédent chronique ne peut pas être archivé. */
public class ChronicConditionCannotBeArchivedException extends ApiException {
    public static final int STATUS = 409;

    public ChronicConditionCannotBeArchivedException() { this("Un antécédent chronique ne peut pas être archivé"); }

    public ChronicConditionCannotBeArchivedException(String message) { super("ChronicConditionCannotBeArchivedException", message, STATUS); }
}
