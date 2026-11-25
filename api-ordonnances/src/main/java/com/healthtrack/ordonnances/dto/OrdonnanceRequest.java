package com.healthtrack.ordonnances.dto;
import jakarta.validation.constraints.NotBlank;
public record OrdonnanceRequest(@NotBlank String compteRenduId) {}
