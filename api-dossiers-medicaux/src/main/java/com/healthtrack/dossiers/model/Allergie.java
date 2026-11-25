package com.healthtrack.dossiers.model;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;
@DynamoDbBean
public class Allergie {
    private String allergieId; private String patientId; private String medicamentConcerne; private String severite; private String dateDecouverte; private String description; private String createdAt; private String updatedAt;
    @DynamoDbPartitionKey @DynamoDbAttribute("allergieId") public String getAllergieId() { return allergieId; } public void setAllergieId(String v) { allergieId = v; }
    @DynamoDbSecondaryPartitionKey(indexNames = "byPatient") @DynamoDbAttribute("patientId") public String getPatientId() { return patientId; } public void setPatientId(String v) { patientId = v; }
    @DynamoDbAttribute("médicamentConcerne") public String getMedicamentConcerne() { return medicamentConcerne; } public void setMedicamentConcerne(String v) { medicamentConcerne = v; }
    @DynamoDbAttribute("sévérité") public String getSeverite() { return severite; } public void setSeverite(String v) { severite = v; }
    @DynamoDbAttribute("dateDécouverte") public String getDateDecouverte() { return dateDecouverte; } public void setDateDecouverte(String v) { dateDecouverte = v; }
    @DynamoDbAttribute("description") public String getDescription() { return description; } public void setDescription(String v) { description = v; }
    @DynamoDbAttribute("createdAt") public String getCreatedAt() { return createdAt; } public void setCreatedAt(String v) { createdAt = v; }
    @DynamoDbAttribute("updatedAt") public String getUpdatedAt() { return updatedAt; } public void setUpdatedAt(String v) { updatedAt = v; }
}
