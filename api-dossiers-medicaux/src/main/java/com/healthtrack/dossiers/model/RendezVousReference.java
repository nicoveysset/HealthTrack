package com.healthtrack.dossiers.model;

import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondaryPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondarySortKey;

@DynamoDbBean
public class RendezVousReference {
    private String rdvId;
    private String patientId;
    private String praticienId;
    private String date;
    private String statut;

    @DynamoDbPartitionKey
    @DynamoDbAttribute("rdvId")
    public String getRdvId() { return rdvId; }
    public void setRdvId(String rdvId) { this.rdvId = rdvId; }

    @DynamoDbSecondaryPartitionKey(indexNames = "byPatientAndDate")
    @DynamoDbAttribute("patientId")
    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    @DynamoDbAttribute("praticienId")
    public String getPraticienId() { return praticienId; }
    public void setPraticienId(String praticienId) { this.praticienId = praticienId; }

    @DynamoDbSecondarySortKey(indexNames = "byPatientAndDate")
    @DynamoDbAttribute("date")
    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    @DynamoDbAttribute("statut")
    public String getStatut() { return statut; }
    public void setStatut(String statut) { this.statut = statut; }
}

