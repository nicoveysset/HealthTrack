package com.healthtrack.ordonnances.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Ligne de prescription : médicament, posologie, durée en jours, instructions spécifiques. */
public record LigneRequest(@NotBlank String medicamentId,
                           @NotBlank String posologie,
                           @NotNull @Min(value = 1, message = "doit être d'au moins 1 jour") Integer duree,
                           String instructions) {}
