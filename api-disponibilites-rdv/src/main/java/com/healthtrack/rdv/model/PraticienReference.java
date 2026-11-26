package com.healthtrack.rdv.model;

import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;

@DynamoDbBean
public class PraticienReference {
    private String userId;
    private String type;
    private String statut;
    private String name;
    private String specialite;

    @DynamoDbPartitionKey
    @DynamoDbAttribute("userId")
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    @DynamoDbAttribute("type")
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    @DynamoDbAttribute("statut")
    public String getStatut() { return statut; }
    public void setStatut(String statut) { this.statut = statut; }
    @DynamoDbAttribute("name") public String getName() { return name; }
    public void setName(String v) { name = v; }
    @DynamoDbAttribute("specialite") public String getSpecialite() { return specialite; }
    public void setSpecialite(String v) { specialite = v; }
}
