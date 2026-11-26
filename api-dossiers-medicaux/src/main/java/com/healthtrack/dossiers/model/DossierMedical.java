package com.healthtrack.dossiers.model;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;
@DynamoDbBean
public class DossierMedical {
    private String patientId; private String groupeSanguin; private String dateCreation; private String updatedAt;
    @DynamoDbPartitionKey @DynamoDbAttribute("patientId") public String getPatientId() { return patientId; } public void setPatientId(String v) { patientId = v; }
    @DynamoDbAttribute("groupeSanguin") public String getGroupeSanguin() { return groupeSanguin; } public void setGroupeSanguin(String v) { groupeSanguin = v; }
    @DynamoDbAttribute("dateCreation") public String getDateCreation() { return dateCreation; } public void setDateCreation(String v) { dateCreation = v; }
    @DynamoDbAttribute("updatedAt") public String getUpdatedAt() { return updatedAt; } public void setUpdatedAt(String v) { updatedAt = v; }
}
