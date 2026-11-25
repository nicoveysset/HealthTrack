package com.healthtrack.ordonnances.dto;
import jakarta.validation.constraints.NotBlank;
public record MedicamentRequest(@NotBlank String nom, String substanceActive, @NotBlank String forme, String description) {}
