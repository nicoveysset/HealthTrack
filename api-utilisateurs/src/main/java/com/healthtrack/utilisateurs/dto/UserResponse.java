package com.healthtrack.utilisateurs.dto;
import com.healthtrack.utilisateurs.model.User;

public record UserResponse(
    String userId, String email, String type,
    String name, String firstName, String lastName,
    String specialite, String rpps, String statut,
    String dateNaissance, String nss, String medecinTraitantId,
    String createdAt, String updatedAt
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
