package com.healthtrack.utilisateurs.dto;

public record UpdateProfileRequest(
    String firstName, String lastName, String name,
    String dateNaissance, String nss,
    String specialite, String rpps, String statut
) {}
