package com.healthtrack.rdv.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "indisponibilites")
public class Indisponibilite {
    @Id @Column(length = 36) private String indispoId;
    @Column(nullable = false) private String praticienId;
    @Column(nullable = false) private String dateDebut;
    @Column(nullable = false) private String dateFin;
    private String motif;
    private Boolean recurrente = false;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;

    @PrePersist protected void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = Instant.now(); }

    public String getIndispoId() { return indispoId; } public void setIndispoId(String v) { indispoId = v; }
    public String getPraticienId() { return praticienId; } public void setPraticienId(String v) { praticienId = v; }
    public String getDateDebut() { return dateDebut; } public void setDateDebut(String v) { dateDebut = v; }
    public String getDateFin() { return dateFin; } public void setDateFin(String v) { dateFin = v; }
    public String getMotif() { return motif; } public void setMotif(String v) { motif = v; }
    public Boolean getRecurrente() { return recurrente; } public void setRecurrente(Boolean v) { recurrente = v; }
    public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant v) { createdAt = v; }
    public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant v) { updatedAt = v; }
}
