package com.healthtrack.dossiers.model;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name = "allergies")
public class Allergie {
    @Id @Column(length = 36) private String allergieId;
    @Column(nullable = false) private String patientId;
    @Column(nullable = false) private String medicamentConcerne;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private AllergieSeverite severite;
    private String dateDecouverte;
    private String description;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
    @PrePersist protected void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = Instant.now(); }
    public String getAllergieId() { return allergieId; } public void setAllergieId(String v) { allergieId = v; }
    public String getPatientId() { return patientId; } public void setPatientId(String v) { patientId = v; }
    public String getMedicamentConcerne() { return medicamentConcerne; } public void setMedicamentConcerne(String v) { medicamentConcerne = v; }
    public AllergieSeverite getSeverite() { return severite; } public void setSeverite(AllergieSeverite v) { severite = v; }
    public String getDateDecouverte() { return dateDecouverte; } public void setDateDecouverte(String v) { dateDecouverte = v; }
    public String getDescription() { return description; } public void setDescription(String v) { description = v; }
    public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant v) { createdAt = v; }
    public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant v) { updatedAt = v; }
}
