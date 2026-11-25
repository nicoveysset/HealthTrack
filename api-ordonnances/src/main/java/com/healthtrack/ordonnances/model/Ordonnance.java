package com.healthtrack.ordonnances.model;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;
@DynamoDbBean
public class Ordonnance {
    private String ordonnanceId; private String compteRenduId; private String patientId; private String rdvId; private String praticienId; private String dateEmission; private String dateValidite; private String statut; private String createdAt; private String updatedAt;
    @DynamoDbPartitionKey @DynamoDbAttribute("ordonnanceId") public String getOrdonnanceId() { return ordonnanceId; } public void setOrdonnanceId(String v) { ordonnanceId = v; }
    @DynamoDbSecondaryPartitionKey(indexNames = "byPatientAndDate") @DynamoDbAttribute("patientId") public String getPatientId() { return patientId; } public void setPatientId(String v) { patientId = v; }
    @DynamoDbSecondaryPartitionKey(indexNames = "byCompteRendu") @DynamoDbAttribute("compteRenduId") public String getCompteRenduId() { return compteRenduId; } public void setCompteRenduId(String v) { compteRenduId = v; }
    @DynamoDbSecondaryPartitionKey(indexNames = "byRendezVous") @DynamoDbAttribute("rdvId") public String getRdvId() { return rdvId; } public void setRdvId(String v) { rdvId = v; }
    @DynamoDbAttribute("praticienId") public String getPraticienId() { return praticienId; } public void setPraticienId(String v) { praticienId = v; }
    @DynamoDbSecondarySortKey(indexNames = "byPatientAndDate") @DynamoDbAttribute("dateEmission") public String getDateEmission() { return dateEmission; } public void setDateEmission(String v) { dateEmission = v; }
    @DynamoDbAttribute("dateValidite") public String getDateValidite() { return dateValidite; } public void setDateValidite(String v) { dateValidite = v; }
    @DynamoDbAttribute("statut") public String getStatut() { return statut; } public void setStatut(String v) { statut = v; }
    @DynamoDbAttribute("createdAt") public String getCreatedAt() { return createdAt; } public void setCreatedAt(String v) { createdAt = v; }
    @DynamoDbAttribute("updatedAt") public String getUpdatedAt() { return updatedAt; } public void setUpdatedAt(String v) { updatedAt = v; }
}
