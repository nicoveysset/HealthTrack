package com.healthtrack.ordonnances.repository;

import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;

import java.util.Optional;

@Repository
public class CompteRenduRepository {
    private final DynamoDbTable<CompteRenduReference> table;

    public CompteRenduRepository(DynamoDbEnhancedClient client) {
        this.table = client.table("healthtrack-comptes-rendus", TableSchema.fromBean(CompteRenduReference.class));
    }

    public Optional<CompteRenduReference> findById(String id) {
        return Optional.ofNullable(table.getItem(Key.builder().partitionValue(id).build()));
    }

    @DynamoDbBean
    public static class CompteRenduReference {
        private String compteRenduId;
        private String rdvId;
        private String praticienId;
        private String patientId;
        private String dateFinalisation;

        public CompteRenduReference() {}

        @DynamoDbPartitionKey
        @DynamoDbAttribute("compteRenduId")
        public String getCompteRenduId() { return compteRenduId; }
        public void setCompteRenduId(String compteRenduId) { this.compteRenduId = compteRenduId; }

        @DynamoDbAttribute("rdvId")
        public String getRdvId() { return rdvId; }
        public void setRdvId(String rdvId) { this.rdvId = rdvId; }

        @DynamoDbAttribute("praticienId")
        public String getPraticienId() { return praticienId; }
        public void setPraticienId(String praticienId) { this.praticienId = praticienId; }

        @DynamoDbAttribute("patientId")
        public String getPatientId() { return patientId; }
        public void setPatientId(String patientId) { this.patientId = patientId; }

        @DynamoDbAttribute("dateFinalisation")
        public String getDateFinalisation() { return dateFinalisation; }
        public void setDateFinalisation(String dateFinalisation) { this.dateFinalisation = dateFinalisation; }
    }
}
