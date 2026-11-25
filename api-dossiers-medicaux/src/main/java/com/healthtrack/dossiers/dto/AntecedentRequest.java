package com.healthtrack.dossiers.dto;
import jakarta.validation.constraints.NotBlank;
public record AntecedentRequest(@NotBlank String libelle, @NotBlank String type, String date, String description) {}
