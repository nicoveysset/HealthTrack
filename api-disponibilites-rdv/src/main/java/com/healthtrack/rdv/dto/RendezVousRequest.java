package com.healthtrack.rdv.dto;

import jakarta.validation.constraints.NotBlank;

public record RendezVousRequest(
    @NotBlank String praticienId,
    @NotBlank String date,
    @NotBlank String heure,
    Integer duree
) {}
