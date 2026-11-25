package com.healthtrack.rdv.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "disponibilites")
public class Disponibilite {
    @Id @Column(length = 36) private String dispoId;
    @Column(nullable = false) private String praticienId;
    @Column(nullable = false) private String jourSemaine;
    @Column(nullable = false) private String heureDebut;
    @Column(nullable = false) private String heureFin;
    private Boolean recurrente = true;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;

    @PrePersist protected void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = Instant.now(); }

    public String getDispoId() { return dispoId; } public void setDispoId(String v) { dispoId = v; }
    public String getPraticienId() { return praticienId; } public void setPraticienId(String v) { praticienId = v; }
    public String getJourSemaine() { return jourSemaine; } public void setJourSemaine(String v) { jourSemaine = v; }
    public String getHeureDebut() { return heureDebut; } public void setHeureDebut(String v) { heureDebut = v; }
    public String getHeureFin() { return heureFin; } public void setHeureFin(String v) { heureFin = v; }
    public Boolean getRecurrente() { return recurrente; } public void setRecurrente(Boolean v) { recurrente = v; }
    public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant v) { createdAt = v; }
    public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant v) { updatedAt = v; }
}
