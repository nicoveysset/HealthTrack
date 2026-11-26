package com.healthtrack.ordonnances.dto;

import jakarta.validation.constraints.NotBlank;

/** Création d'une ordonnance sur un rendez-vous (qui doit être TERMINE avec un compte rendu finalisé). */
public record OrdonnanceRequest(@NotBlank String rdvId) {}
