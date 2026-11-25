package com.healthtrack.ordonnances.model;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;
@DynamoDbBean
public class LignePrescription {
    private String ordonnanceId; private String ligneId; private String medicamentId; private String posologie; private Integer duree; private String instructions; private String createdAt; private String updatedAt;
    @DynamoDbPartitionKey @DynamoDbAttribute("ordonnanceId") public String getOrdonnanceId() { return ordonnanceId; } public void setOrdonnanceId(String v) { ordonnanceId = v; }
    @DynamoDbSortKey @DynamoDbAttribute("ligneId") public String getLigneId() { return ligneId; } public void setLigneId(String v) { ligneId = v; }
    @DynamoDbAttribute("medicamentId") public String getMedicamentId() { return medicamentId; } public void setMedicamentId(String v) { medicamentId = v; }
    @DynamoDbAttribute("posologie") public String getPosologie() { return posologie; } public void setPosologie(String v) { posologie = v; }
    @DynamoDbAttribute("duree") public Integer getDuree() { return duree; } public void setDuree(Integer v) { duree = v; }
    @DynamoDbAttribute("instructions") public String getInstructions() { return instructions; } public void setInstructions(String v) { instructions = v; }
    @DynamoDbAttribute("createdAt") public String getCreatedAt() { return createdAt; } public void setCreatedAt(String v) { createdAt = v; }
    @DynamoDbAttribute("updatedAt") public String getUpdatedAt() { return updatedAt; } public void setUpdatedAt(String v) { updatedAt = v; }
}
