package com.healthtrack.rdv.model;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;

@DynamoDbBean
public class Indisponibilite {
    private String indispoId;
    private String praticienId;
    private String dateDebut;
    private String dateFin;
    private String motif;
    private Boolean recurrente;
    private String createdAt;
    private String updatedAt;

    @DynamoDbPartitionKey @DynamoDbAttribute("indispoId") public String getIndispoId() { return indispoId; }
    public void setIndispoId(String v) { indispoId = v; }
    @DynamoDbSecondaryPartitionKey(indexNames = "byPraticien") @DynamoDbAttribute("praticienId") public String getPraticienId() { return praticienId; }
    public void setPraticienId(String v) { praticienId = v; }
    @DynamoDbAttribute("dateDebut") public String getDateDebut() { return dateDebut; }
    public void setDateDebut(String v) { dateDebut = v; }
    @DynamoDbAttribute("dateFin") public String getDateFin() { return dateFin; }
    public void setDateFin(String v) { dateFin = v; }
    @DynamoDbAttribute("motif") public String getMotif() { return motif; }
    public void setMotif(String v) { motif = v; }
    @DynamoDbAttribute("récurrente") public Boolean getRecurrente() { return recurrente; }
    public void setRecurrente(Boolean v) { recurrente = v; }
    @DynamoDbAttribute("createdAt") public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String v) { createdAt = v; }
    @DynamoDbAttribute("updatedAt") public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String v) { updatedAt = v; }
}
