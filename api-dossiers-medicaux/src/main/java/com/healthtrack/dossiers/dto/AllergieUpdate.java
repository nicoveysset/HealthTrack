package com.healthtrack.dossiers.dto;

/** Modification partielle d'une allergie (tracée dans CloudWatch avec l'identité de l'auteur). */
public record AllergieUpdate(String medicamentConcerne, String severite, String dateDecouverte, String description) {}
