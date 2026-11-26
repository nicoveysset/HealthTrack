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
                if (allergyMatches(allergie.getMedicamentConcerne(), nom, substanceActive)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Une allergie correspond à un médicament si son libellé correspond au nom commercial
     * ou à la substance active, en entier ou comme mot (ex. allergie "Amoxicilline" ↔
     * "Amoxicilline 500 mg" ou "Augmentin" (amoxicilline + acide clavulanique)). Accents et casse ignorés.
     */
    static boolean allergyMatches(String allergie, String nom, String substance) {
        String a = normalize(allergie);
        if (a.isEmpty()) return false;
        return containsWord(normalize(nom), a) || containsWord(normalize(substance), a);
    }

    private static boolean containsWord(String text, String word) {
        if (text.isEmpty()) return false;
        String t = " " + text.replaceAll("[^a-z0-9]+", " ").trim() + " ";
        String w = " " + word.replaceAll("[^a-z0-9]+", " ").trim() + " ";
        return t.contains(w);
    }

    private static String normalize(String value) {
        if (value == null) return "";
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
