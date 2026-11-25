package com.healthtrack.utilisateurs.dto;

import com.healthtrack.utilisateurs.model.User;
import com.healthtrack.utilisateurs.model.UserType;
import com.healthtrack.utilisateurs.model.PraticienStatut;
import java.time.Instant;

public record UserResponse(
    String userId, String email, UserType type,
    String name, String firstName, String lastName,
    String specialite, String rpps, PraticienStatut statut,
    String dateNaissance, String nss, String medecinTraitantId,
    Instant createdAt, Instant updatedAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
            user.getUserId(), user.getEmail(), user.getType(),
            user.getName(), user.getFirstName(), user.getLastName(),
            user.getSpecialite(), user.getRpps(), user.getStatut(),
            user.getDateNaissance(), user.getNss(), user.getMedecinTraitantId(),
            user.getCreatedAt(), user.getUpdatedAt()
        );
    }
}
