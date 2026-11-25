package com.healthtrack.rdv.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "rendezvous")
public class RendezVous {
    @Id @Column(length = 36) private String rdvId;
    @Column(nullable = false) private String praticienId;
    @Column(nullable = false) private String patientId;
    @Column(nullable = false) private String date; // YYYY-MM-DD
    @Column(nullable = false) private String heure; // HH:MM
    private Integer duree = 30;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private RendezVousStatut statut;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;

    @PrePersist protected void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = Instant.now(); }

    public String getRdvId() { return rdvId; } public void setRdvId(String v) { rdvId = v; }
    public String getPraticienId() { return praticienId; } public void setPraticienId(String v) { praticienId = v; }
    public String getPatientId() { return patientId; } public void setPatientId(String v) { patientId = v; }
    public String getDate() { return date; } public void setDate(String v) { date = v; }
    public String getHeure() { return heure; } public void setHeure(String v) { heure = v; }
    public Integer getDuree() { return duree; } public void setDuree(Integer v) { duree = v; }
    public RendezVousStatut getStatut() { return statut; } public void setStatut(RendezVousStatut v) { statut = v; }
    public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant v) { createdAt = v; }
    public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant v) { updatedAt = v; }
}
