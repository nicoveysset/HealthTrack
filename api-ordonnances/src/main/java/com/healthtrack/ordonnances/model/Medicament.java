package com.healthtrack.ordonnances.model;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name = "medicaments")
public class Medicament {
    @Id @Column(length = 36) private String medicamentId;
    @Column(nullable = false) private String nom;
    private String substanceActive;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private MedicamentForme forme;
    private String description;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
    @PrePersist protected void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = Instant.now(); }
    public String getMedicamentId() { return medicamentId; } public void setMedicamentId(String v) { medicamentId = v; }
    public String getNom() { return nom; } public void setNom(String v) { nom = v; }
    public String getSubstanceActive() { return substanceActive; } public void setSubstanceActive(String v) { substanceActive = v; }
    public MedicamentForme getForme() { return forme; } public void setForme(MedicamentForme v) { forme = v; }
    public String getDescription() { return description; } public void setDescription(String v) { description = v; }
    public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant v) { createdAt = v; }
    public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant v) { updatedAt = v; }
}
