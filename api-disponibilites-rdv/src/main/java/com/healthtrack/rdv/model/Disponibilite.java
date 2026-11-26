package com.healthtrack.rdv.model;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;

@DynamoDbBean
public class Disponibilite {
    private String dispoId;
    private String praticienId;
    private String jourSemaine;
    private String heureDebut;
    private String heureFin;
    private Boolean recurrente;
    private String createdAt;
    private String updatedAt;

    @DynamoDbPartitionKey @DynamoDbAttribute("dispoId") public String getDispoId() { return dispoId; }
    public void setDispoId(String v) { dispoId = v; }
    @DynamoDbSecondaryPartitionKey(indexNames = "byPraticien") @DynamoDbAttribute("praticienId") public String getPraticienId() { return praticienId; }
    public void setPraticienId(String v) { praticienId = v; }
    @DynamoDbAttribute("jourSemaine") public String getJourSemaine() { return jourSemaine; }
    public void setJourSemaine(String v) { jourSemaine = v; }
    @DynamoDbAttribute("heureDebut") public String getHeureDebut() { return heureDebut; }
    public void setHeureDebut(String v) { heureDebut = v; }
    @DynamoDbAttribute("heureFin") public String getHeureFin() { return heureFin; }
    public void setHeureFin(String v) { heureFin = v; }
    @DynamoDbAttribute("récurrente") public Boolean getRecurrente() { return recurrente; }
    public void setRecurrente(Boolean v) { recurrente = v; }
    @DynamoDbAttribute("createdAt") public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String v) { createdAt = v; }
    @DynamoDbAttribute("updatedAt") public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String v) { updatedAt = v; }
}
