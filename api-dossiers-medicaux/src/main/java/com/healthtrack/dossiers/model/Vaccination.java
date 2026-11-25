package com.healthtrack.dossiers.model;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name = "vaccinations")
public class Vaccination {
    @Id @Column(length = 36) private String vaccinationId;
    @Column(nullable = false) private String dossierId;
    @Column(nullable = false) private String nomVaccin;
    @Column(nullable = false) private String date;
    private String rappelPrevu;
    private String description;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
    @PrePersist protected void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = Instant.now(); }
    public String getVaccinationId() { return vaccinationId; } public void setVaccinationId(String v) { vaccinationId = v; }
    public String getDossierId() { return dossierId; } public void setDossierId(String v) { dossierId = v; }
    public String getNomVaccin() { return nomVaccin; } public void setNomVaccin(String v) { nomVaccin = v; }
    public String getDate() { return date; } public void setDate(String v) { date = v; }
    public String getRappelPrevu() { return rappelPrevu; } public void setRappelPrevu(String v) { rappelPrevu = v; }
    public String getDescription() { return description; } public void setDescription(String v) { description = v; }
    public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant v) { createdAt = v; }
    public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant v) { updatedAt = v; }
}
