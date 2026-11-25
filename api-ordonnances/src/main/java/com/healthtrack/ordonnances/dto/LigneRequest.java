package com.healthtrack.ordonnances.dto;
import jakarta.validation.constraints.NotBlank;
public record LigneRequest(@NotBlank String medicamentId, @NotBlank String posologie, Integer duree, String instructions) {}
