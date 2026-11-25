package com.healthtrack.ordonnances.model;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name = "lignes_prescription")
public class LignePrescription {
    @Id @Column(length = 36) private String ligneId;
    @Column(nullable = false) private String ordonnanceId;
    @Column(nullable = false) private String medicamentId;
    @Column(nullable = false) private String posologie;
    private Integer duree;
    private String instructions;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
    @PrePersist protected void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = Instant.now(); }
    public String getLigneId() { return ligneId; } public void setLigneId(String v) { ligneId = v; }
    public String getOrdonnanceId() { return ordonnanceId; } public void setOrdonnanceId(String v) { ordonnanceId = v; }
    public String getMedicamentId() { return medicamentId; } public void setMedicamentId(String v) { medicamentId = v; }
    public String getPosologie() { return posologie; } public void setPosologie(String v) { posologie = v; }
    public Integer getDuree() { return duree; } public void setDuree(Integer v) { duree = v; }
    public String getInstructions() { return instructions; } public void setInstructions(String v) { instructions = v; }
    public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant v) { createdAt = v; }
    public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant v) { updatedAt = v; }
}
