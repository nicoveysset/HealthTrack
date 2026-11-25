package com.healthtrack.dossiers.dto;
import jakarta.validation.constraints.NotBlank;
public record VaccinationRequest(@NotBlank String nomVaccin, @NotBlank String date, String rappelPrevu, String description) {}
