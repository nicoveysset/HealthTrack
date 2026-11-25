package com.healthtrack.dossiers.model;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name = "dossiers_medicaux")
public class DossierMedical {
    @Id @Column(length = 36) private String patientId;
    private String groupeSanguin;
    @Column(nullable = false, updatable = false) private Instant dateCreation;
    @Column(nullable = false) private Instant updatedAt;
    @PrePersist protected void onCreate() { dateCreation = Instant.now(); updatedAt = Instant.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = Instant.now(); }
    public String getPatientId() { return patientId; } public void setPatientId(String v) { patientId = v; }
    public String getGroupeSanguin() { return groupeSanguin; } public void setGroupeSanguin(String v) { groupeSanguin = v; }
    public Instant getDateCreation() { return dateCreation; } public void setDateCreation(Instant v) { dateCreation = v; }
    public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant v) { updatedAt = v; }
}
