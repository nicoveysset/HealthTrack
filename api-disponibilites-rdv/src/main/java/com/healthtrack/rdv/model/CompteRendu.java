package com.healthtrack.rdv.model;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;

@DynamoDbBean
public class CompteRendu {
    private String compteRenduId;
    private String rdvId;
    private String praticienId;
    private String patientId;
    private String contenu;
    private String dateFinalisation;
    private String createdAt;
    private String updatedAt;

    @DynamoDbPartitionKey @DynamoDbAttribute("compteRenduId") public String getCompteRenduId() { return compteRenduId; }
    public void setCompteRenduId(String v) { compteRenduId = v; }
    @DynamoDbSecondaryPartitionKey(indexNames = "byRdv") @DynamoDbAttribute("rdvId") public String getRdvId() { return rdvId; }
    public void setRdvId(String v) { rdvId = v; }
    @DynamoDbAttribute("praticienId") public String getPraticienId() { return praticienId; }
    public void setPraticienId(String v) { praticienId = v; }
    @DynamoDbAttribute("patientId") public String getPatientId() { return patientId; }
    public void setPatientId(String v) { patientId = v; }
    @DynamoDbAttribute("contenu") public String getContenu() { return contenu; }
    public void setContenu(String v) { contenu = v; }
    @DynamoDbAttribute("dateFinalisation") public String getDateFinalisation() { return dateFinalisation; }
    public void setDateFinalisation(String v) { dateFinalisation = v; }
    @DynamoDbAttribute("createdAt") public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String v) { createdAt = v; }
    @DynamoDbAttribute("updatedAt") public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String v) { updatedAt = v; }
}
