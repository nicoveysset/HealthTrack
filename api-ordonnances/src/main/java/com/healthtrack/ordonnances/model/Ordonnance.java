package com.healthtrack.ordonnances.model;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name = "ordonnances")
public class Ordonnance {
    @Id @Column(length = 36) private String ordonnanceId;
    @Column(nullable = false) private String compteRenduId;
    @Column(nullable = false) private String patientId;
    @Column(nullable = false) private String praticienId;
    @Column(nullable = false) private String dateEmission;
    @Column(nullable = false) private String dateValidite;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private OrdonnanceStatut statut;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
    @PrePersist protected void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = Instant.now(); }
    public String getOrdonnanceId() { return ordonnanceId; } public void setOrdonnanceId(String v) { ordonnanceId = v; }
    public String getCompteRenduId() { return compteRenduId; } public void setCompteRenduId(String v) { compteRenduId = v; }
    public String getPatientId() { return patientId; } public void setPatientId(String v) { patientId = v; }
    public String getPraticienId() { return praticienId; } public void setPraticienId(String v) { praticienId = v; }
    public String getDateEmission() { return dateEmission; } public void setDateEmission(String v) { dateEmission = v; }
    public String getDateValidite() { return dateValidite; } public void setDateValidite(String v) { dateValidite = v; }
    public OrdonnanceStatut getStatut() { return statut; } public void setStatut(OrdonnanceStatut v) { statut = v; }
    public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant v) { createdAt = v; }
    public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant v) { updatedAt = v; }
}
