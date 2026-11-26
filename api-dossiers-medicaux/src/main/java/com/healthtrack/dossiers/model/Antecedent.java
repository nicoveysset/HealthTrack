package com.healthtrack.dossiers.model;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;
@DynamoDbBean
public class Antecedent {
    private String antecedentId; private String dossierId; private String libelle; private String type; private String date; private String statut; private String description; private String createdAt; private String updatedAt;
    @DynamoDbPartitionKey @DynamoDbAttribute("antecedentId") public String getAntecedentId() { return antecedentId; } public void setAntecedentId(String v) { antecedentId = v; }
    @DynamoDbSecondaryPartitionKey(indexNames = "byDossier") @DynamoDbAttribute("dossierId") public String getDossierId() { return dossierId; } public void setDossierId(String v) { dossierId = v; }
    @DynamoDbAttribute("libellé") public String getLibelle() { return libelle; } public void setLibelle(String v) { libelle = v; }
    @DynamoDbAttribute("type") public String getType() { return type; } public void setType(String v) { type = v; }
    @DynamoDbAttribute("date") public String getDate() { return date; } public void setDate(String v) { date = v; }
    @DynamoDbAttribute("statut") public String getStatut() { return statut; } public void setStatut(String v) { statut = v; }
    @DynamoDbAttribute("description") public String getDescription() { return description; } public void setDescription(String v) { description = v; }
    @DynamoDbAttribute("createdAt") public String getCreatedAt() { return createdAt; } public void setCreatedAt(String v) { createdAt = v; }
    @DynamoDbAttribute("updatedAt") public String getUpdatedAt() { return updatedAt; } public void setUpdatedAt(String v) { updatedAt = v; }
}
