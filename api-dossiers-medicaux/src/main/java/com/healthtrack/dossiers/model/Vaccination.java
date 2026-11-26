package com.healthtrack.dossiers.model;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;
@DynamoDbBean
public class Vaccination {
    private String vaccinationId; private String dossierId; private String nomVaccin; private String date; private String rappelPrevu; private String description; private String createdAt; private String updatedAt;
    @DynamoDbPartitionKey @DynamoDbAttribute("vaccinationId") public String getVaccinationId() { return vaccinationId; } public void setVaccinationId(String v) { vaccinationId = v; }
    @DynamoDbSecondaryPartitionKey(indexNames = "byDossier") @DynamoDbAttribute("dossierId") public String getDossierId() { return dossierId; } public void setDossierId(String v) { dossierId = v; }
    @DynamoDbAttribute("nomVaccin") public String getNomVaccin() { return nomVaccin; } public void setNomVaccin(String v) { nomVaccin = v; }
    @DynamoDbAttribute("date") public String getDate() { return date; } public void setDate(String v) { date = v; }
    @DynamoDbAttribute("rappelPrévu") public String getRappelPrevu() { return rappelPrevu; } public void setRappelPrevu(String v) { rappelPrevu = v; }
    @DynamoDbAttribute("description") public String getDescription() { return description; } public void setDescription(String v) { description = v; }
    @DynamoDbAttribute("createdAt") public String getCreatedAt() { return createdAt; } public void setCreatedAt(String v) { createdAt = v; }
    @DynamoDbAttribute("updatedAt") public String getUpdatedAt() { return updatedAt; } public void setUpdatedAt(String v) { updatedAt = v; }
}
