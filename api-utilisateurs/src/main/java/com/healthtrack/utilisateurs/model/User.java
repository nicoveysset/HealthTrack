package com.healthtrack.utilisateurs.model;

import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;

@DynamoDbBean
public class User {
    private String userId;
    private String email;
    private String passwordHash;
    private String type; // PRATICIEN ou PATIENT
    private String name;
    private String firstName;
    private String lastName;
    private String createdAt;
    private String updatedAt;
    private String specialite;
    private String rpps;
    private String statut; // ACTIF, EN_CONGE, INACTIF
    private String dateNaissance;
    private String nss;
    private String medecinTraitantId;

    @DynamoDbPartitionKey
    @DynamoDbAttribute("userId")
    public String getUserId() { return userId; }
    public void setUserId(String v) { userId = v; }

    @DynamoDbSecondaryPartitionKey(indexNames = "byEmail")
    @DynamoDbAttribute("email")
    public String getEmail() { return email; }
    public void setEmail(String v) { email = v; }

    @DynamoDbAttribute("passwordHash") public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String v) { passwordHash = v; }
    @DynamoDbAttribute("type") public String getType() { return type; }
    public void setType(String v) { type = v; }
    @DynamoDbAttribute("name") public String getName() { return name; }
    public void setName(String v) { name = v; }
    @DynamoDbAttribute("firstName") public String getFirstName() { return firstName; }
    public void setFirstName(String v) { firstName = v; }
    @DynamoDbAttribute("lastName") public String getLastName() { return lastName; }
    public void setLastName(String v) { lastName = v; }
    @DynamoDbAttribute("createdAt") public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String v) { createdAt = v; }
    @DynamoDbAttribute("updatedAt") public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String v) { updatedAt = v; }
    @DynamoDbAttribute("specialite") public String getSpecialite() { return specialite; }
    public void setSpecialite(String v) { specialite = v; }
    @DynamoDbAttribute("rpps") public String getRpps() { return rpps; }
    public void setRpps(String v) { rpps = v; }
    @DynamoDbAttribute("statut") public String getStatut() { return statut; }
    public void setStatut(String v) { statut = v; }
    @DynamoDbAttribute("dateNaissance") public String getDateNaissance() { return dateNaissance; }
    public void setDateNaissance(String v) { dateNaissance = v; }
    @DynamoDbAttribute("nss") public String getNss() { return nss; }
    public void setNss(String v) { nss = v; }
    @DynamoDbAttribute("medecinTraitantId") public String getMedecinTraitantId() { return medecinTraitantId; }
    public void setMedecinTraitantId(String v) { medecinTraitantId = v; }
}
