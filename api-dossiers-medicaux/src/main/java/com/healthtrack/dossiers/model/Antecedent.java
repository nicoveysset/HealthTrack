package com.healthtrack.dossiers.model;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name = "antecedents")
public class Antecedent {
    @Id @Column(length = 36) private String antecedentId;
    @Column(nullable = false) private String dossierId;
    @Column(nullable = false) private String libelle;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private AntecedentType type;
    private String date;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private AntecedentStatut statut;
    private String description;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
    @PrePersist protected void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = Instant.now(); }
    public String getAntecedentId() { return antecedentId; } public void setAntecedentId(String v) { antecedentId = v; }
    public String getDossierId() { return dossierId; } public void setDossierId(String v) { dossierId = v; }
    public String getLibelle() { return libelle; } public void setLibelle(String v) { libelle = v; }
    public AntecedentType getType() { return type; } public void setType(AntecedentType v) { type = v; }
    public String getDate() { return date; } public void setDate(String v) { date = v; }
    public AntecedentStatut getStatut() { return statut; } public void setStatut(AntecedentStatut v) { statut = v; }
    public String getDescription() { return description; } public void setDescription(String v) { description = v; }
    public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant v) { createdAt = v; }
    public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant v) { updatedAt = v; }
}
