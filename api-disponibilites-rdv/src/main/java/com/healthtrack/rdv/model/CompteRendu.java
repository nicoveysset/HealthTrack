package com.healthtrack.rdv.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "comptes_rendus")
public class CompteRendu {
    @Id @Column(length = 36) private String compteRenduId;
    @Column(nullable = false) private String rdvId;
    @Column(nullable = false) private String praticienId;
    @Column(nullable = false) private String patientId;
    @Column(nullable = false, columnDefinition = "TEXT") private String contenu;
    @Column(nullable = false) private String dateFinalisation;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;

    @PrePersist protected void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = Instant.now(); }

    public String getCompteRenduId() { return compteRenduId; } public void setCompteRenduId(String v) { compteRenduId = v; }
    public String getRdvId() { return rdvId; } public void setRdvId(String v) { rdvId = v; }
    public String getPraticienId() { return praticienId; } public void setPraticienId(String v) { praticienId = v; }
    public String getPatientId() { return patientId; } public void setPatientId(String v) { patientId = v; }
    public String getContenu() { return contenu; } public void setContenu(String v) { contenu = v; }
    public String getDateFinalisation() { return dateFinalisation; } public void setDateFinalisation(String v) { dateFinalisation = v; }
    public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant v) { createdAt = v; }
    public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant v) { updatedAt = v; }
}
