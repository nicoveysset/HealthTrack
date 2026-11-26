package com.healthtrack.rdv.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Prise de rendez-vous.
 * @param patientId uniquement quand un praticien prend le rendez-vous pour un patient (sinon ignoré)
 */
public record RendezVousRequest(
    @NotBlank String praticienId,
    @NotBlank String date,
    @NotBlank String heure,
    Integer duree,
    String motif,
    String patientId
) {}
