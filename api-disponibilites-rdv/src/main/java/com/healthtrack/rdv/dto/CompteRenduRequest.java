package com.healthtrack.rdv.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Rédaction d'un compte rendu.
 * @param finaliser true pour finaliser immédiatement (sinon le compte rendu reste en BROUILLON)
 */
public record CompteRenduRequest(@NotBlank @Size(min = 10, message = "doit contenir au moins 10 caractères") String contenu,
                                 String diagnostic,
                                 Boolean finaliser) {}
