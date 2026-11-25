package com.healthtrack.utilisateurs.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "utilisateurs")
public class User {

    @Id
    @Column(name = "user_id", length = 36)
    private String userId;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserType type;

    private String name;
    private String firstName;
    private String lastName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    // Champs praticien
    private String specialite;
    private String rpps;

    @Enumerated(EnumType.STRING)
    private PraticienStatut statut;

    // Champs patient
    private String dateNaissance;
    private String nss;
    private String medecinTraitantId;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    // Getters / Setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public UserType getType() { return type; }
    public void setType(UserType type) { this.type = type; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public String getSpecialite() { return specialite; }
    public void setSpecialite(String specialite) { this.specialite = specialite; }
    public String getRpps() { return rpps; }
    public void setRpps(String rpps) { this.rpps = rpps; }
    public PraticienStatut getStatut() { return statut; }
    public void setStatut(PraticienStatut statut) { this.statut = statut; }
    public String getDateNaissance() { return dateNaissance; }
    public void setDateNaissance(String dateNaissance) { this.dateNaissance = dateNaissance; }
    public String getNss() { return nss; }
    public void setNss(String nss) { this.nss = nss; }
    public String getMedecinTraitantId() { return medecinTraitantId; }
    public void setMedecinTraitantId(String medecinTraitantId) { this.medecinTraitantId = medecinTraitantId; }
}
