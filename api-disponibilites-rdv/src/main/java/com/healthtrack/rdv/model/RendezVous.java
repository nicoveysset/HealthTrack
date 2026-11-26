package com.healthtrack.rdv.model;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;

@DynamoDbBean
public class RendezVous {
    private String rdvId;
    private String praticienId;
    private String patientId;
    private String date;
    private String heure;
    private Integer duree;
    private String statut;
    private String patientNom;
    private String praticienNom;
    private String motif;
    private String createdAt;
    private String updatedAt;

    @DynamoDbPartitionKey @DynamoDbAttribute("rdvId") public String getRdvId() { return rdvId; }
    public void setRdvId(String v) { rdvId = v; }
    @DynamoDbSecondaryPartitionKey(indexNames = "byPraticienAndDate") @DynamoDbAttribute("praticienId") public String getPraticienId() { return praticienId; }
    public void setPraticienId(String v) { praticienId = v; }
    @DynamoDbSecondaryPartitionKey(indexNames = "byPatientAndDate") @DynamoDbAttribute("patientId") public String getPatientId() { return patientId; }
    public void setPatientId(String v) { patientId = v; }
    @DynamoDbSecondarySortKey(indexNames = {"byPraticienAndDate", "byPatientAndDate"}) @DynamoDbAttribute("date") public String getDate() { return date; }
    public void setDate(String v) { date = v; }
    @DynamoDbAttribute("heure") public String getHeure() { return heure; }
    public void setHeure(String v) { heure = v; }
    @DynamoDbAttribute("duree") public Integer getDuree() { return duree; }
    public void setDuree(Integer v) { duree = v; }
    @DynamoDbAttribute("statut") public String getStatut() { return statut; }
    public void setStatut(String v) { statut = v; }
    @DynamoDbAttribute("createdAt") public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String v) { createdAt = v; }
    @DynamoDbAttribute("updatedAt") public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String v) { updatedAt = v; }
    @DynamoDbAttribute("patientNom") public String getPatientNom() { return patientNom; }
    public void setPatientNom(String v) { patientNom = v; }
    @DynamoDbAttribute("praticienNom") public String getPraticienNom() { return praticienNom; }
    public void setPraticienNom(String v) { praticienNom = v; }
    @DynamoDbAttribute("motif") public String getMotif() { return motif; }
    public void setMotif(String v) { motif = v; }
}
