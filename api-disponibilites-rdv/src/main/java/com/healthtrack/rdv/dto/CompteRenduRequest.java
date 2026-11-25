package com.healthtrack.rdv.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CompteRenduRequest(@NotBlank @Size(min = 10) String contenu) {}
