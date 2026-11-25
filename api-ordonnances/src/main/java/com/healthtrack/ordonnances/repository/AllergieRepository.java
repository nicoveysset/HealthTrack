package com.healthtrack.ordonnances.repository;

import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondaryPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryConditional;

import java.text.Normalizer;
import java.util.Locale;

@Repository
public class AllergieRepository {
    private final DynamoDbTable<AllergieReference> table;

    public AllergieRepository(DynamoDbEnhancedClient client) {
        this.table = client.table("healthtrack-allergies", TableSchema.fromBean(AllergieReference.class));
    }

    public boolean conflictsWith(String patientId, String nom, String substanceActive) {
        var index = table.index("byPatient");
        for (var page : index.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(patientId).build()))) {
            for (AllergieReference allergie : page.items()) {
                if (sameMedication(allergie.getMedicamentConcerne(), nom)
                    || sameMedication(allergie.getMedicamentConcerne(), substanceActive)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean sameMedication(String first, String second) {
        if (first == null || second == null) return false;
        return normalize(first).equals(normalize(second));
    }

    private String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .trim()
            .toLowerCase(Locale.ROOT);
    }

    @DynamoDbBean
    public static class AllergieReference {
        private String allergieId;
        private String patientId;
        private String medicamentConcerne;

        public AllergieReference() {}

        @DynamoDbPartitionKey
        @DynamoDbAttribute("allergieId")
        public String getAllergieId() { return allergieId; }
        public void setAllergieId(String allergieId) { this.allergieId = allergieId; }

        @DynamoDbSecondaryPartitionKey(indexNames = "byPatient")
        @DynamoDbAttribute("patientId")
        public String getPatientId() { return patientId; }
        public void setPatientId(String patientId) { this.patientId = patientId; }

        @DynamoDbAttribute("médicamentConcerne")
        public String getMedicamentConcerne() { return medicamentConcerne; }
        public void setMedicamentConcerne(String medicamentConcerne) { this.medicamentConcerne = medicamentConcerne; }
    }
}
