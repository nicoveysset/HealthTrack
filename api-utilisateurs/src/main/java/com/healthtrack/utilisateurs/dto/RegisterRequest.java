package com.healthtrack.utilisateurs.dto;

import com.healthtrack.utilisateurs.model.UserType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8) String password,
    @NotBlank String type,
    @NotBlank String firstName,
    @NotBlank String lastName,
    String specialite,
    String rpps,
    String dateNaissance,
    String nss
) {
    public UserType getUserType() {
        return UserType.valueOf(type);
    }
}
