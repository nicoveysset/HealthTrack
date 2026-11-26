package com.healthtrack.rdv.dto;

import jakarta.validation.constraints.NotBlank;

/** Changement de statut d'un rendez-vous : CONFIRME, EN_COURS, TERMINE, ANNULE ou NON_VENU. */
public record StatutRdvRequest(@NotBlank String statut) {}
