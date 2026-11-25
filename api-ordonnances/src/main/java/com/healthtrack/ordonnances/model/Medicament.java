package com.healthtrack.ordonnances.model;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;
@DynamoDbBean
public class Medicament {
    private String medicamentId; private String nom; private String substanceActive; private String forme; private String description; private String createdAt; private String updatedAt;
    @DynamoDbPartitionKey @DynamoDbAttribute("medicamentId") public String getMedicamentId() { return medicamentId; } public void setMedicamentId(String v) { medicamentId = v; }
    @DynamoDbAttribute("nom") public String getNom() { return nom; } public void setNom(String v) { nom = v; }
    @DynamoDbSecondaryPartitionKey(indexNames = "byForme") @DynamoDbAttribute("forme") public String getForme() { return forme; } public void setForme(String v) { forme = v; }
    @DynamoDbAttribute("substanceActive") public String getSubstanceActive() { return substanceActive; } public void setSubstanceActive(String v) { substanceActive = v; }
    @DynamoDbAttribute("description") public String getDescription() { return description; } public void setDescription(String v) { description = v; }
    @DynamoDbAttribute("createdAt") public String getCreatedAt() { return createdAt; } public void setCreatedAt(String v) { createdAt = v; }
    @DynamoDbAttribute("updatedAt") public String getUpdatedAt() { return updatedAt; } public void setUpdatedAt(String v) { updatedAt = v; }
}
