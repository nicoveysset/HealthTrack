package com.healthtrack.rdv.dto;

import jakarta.validation.constraints.NotBlank;

public record IndisponibiliteRequest(
    @NotBlank String dateDebut,
    @NotBlank String dateFin,
    String motif
) {}
