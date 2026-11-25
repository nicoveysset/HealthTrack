package com.healthtrack.dossiers.dto;
import jakarta.validation.constraints.NotBlank;
public record AllergieRequest(@NotBlank String medicamentConcerne, @NotBlank String severite, String dateDecouverte, String description) {}
