package com.healthtrack.utilisateurs.dto;

import jakarta.validation.constraints.NotBlank;

public record MedecinTraitantRequest(@NotBlank String medecinTraitantId) {}
