package com.healthtrack.dossiers.repository;

import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondaryPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondarySortKey;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryConditional;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Locale;

@Repository
public class PrescriptionLookupRepository {
    private final DynamoDbTable<OrdonnanceReference> ordonnances;
    private final DynamoDbTable<LignePrescriptionReference> lignes;
    private final DynamoDbTable<MedicamentReference> medicaments;

    public PrescriptionLookupRepository(DynamoDbEnhancedClient client) {
        ordonnances = client.table("healthtrack-ordonnances", TableSchema.fromBean(OrdonnanceReference.class));
        lignes = client.table("healthtrack-lignes-prescription", TableSchema.fromBean(LignePrescriptionReference.class));
        medicaments = client.table("healthtrack-medicaments", TableSchema.fromBean(MedicamentReference.class));
    }

    public boolean isAllergyLinkedToActivePrescription(String patientId, String allergyMedication) {
        if (allergyMedication == null || allergyMedication.isBlank()) return false;

        var index = ordonnances.index("byPatientAndDate");
        for (var page : index.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(patientId).build()))) {
            for (OrdonnanceReference ordonnance : page.items()) {
                if (!isActive(ordonnance)) continue;
                for (var linePage : lignes.query(QueryConditional.keyEqualTo(
                    Key.builder().partitionValue(ordonnance.getOrdonnanceId()).build()))) {
                    for (LignePrescriptionReference line : linePage.items()) {
                        MedicamentReference medicament = medicaments.getItem(
                            Key.builder().partitionValue(line.getMedicamentId()).build());
                        if (medicament != null && matches(allergyMedication, medicament)) return true;
                    }
                }
            }
        }
        return false;
    }

    private boolean isActive(OrdonnanceReference ordonnance) {
        if (!"ACTIVE".equals(ordonnance.getStatut())) return false;
        if (ordonnance.getDateValidite() == null) return true;
        return !LocalDateTime.parse(ordonnance.getDateValidite()).isBefore(LocalDateTime.now(ZoneOffset.UTC));
    }

    private boolean matches(String allergyMedication, MedicamentReference medicament) {
        return sameMedication(allergyMedication, medicament.getNom())
            || sameMedication(allergyMedication, medicament.getSubstanceActive());
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
    public static class OrdonnanceReference {
        private String ordonnanceId;
        private String patientId;
        private String dateEmission;
        private String dateValidite;
        private String statut;

        public OrdonnanceReference() {}

        @DynamoDbPartitionKey
        @DynamoDbAttribute("ordonnanceId")
        public String getOrdonnanceId() { return ordonnanceId; }
        public void setOrdonnanceId(String ordonnanceId) { this.ordonnanceId = ordonnanceId; }

        @DynamoDbSecondaryPartitionKey(indexNames = "byPatientAndDate")
        @DynamoDbAttribute("patientId")
        public String getPatientId() { return patientId; }
        public void setPatientId(String patientId) { this.patientId = patientId; }

        @DynamoDbSecondarySortKey(indexNames = "byPatientAndDate")
        @DynamoDbAttribute("dateEmission")
        public String getDateEmission() { return dateEmission; }
        public void setDateEmission(String dateEmission) { this.dateEmission = dateEmission; }

        @DynamoDbAttribute("dateValidite")
        public String getDateValidite() { return dateValidite; }
        public void setDateValidite(String dateValidite) { this.dateValidite = dateValidite; }

        @DynamoDbAttribute("statut")
        public String getStatut() { return statut; }
        public void setStatut(String statut) { this.statut = statut; }
    }

    @DynamoDbBean
    public static class LignePrescriptionReference {
        private String ordonnanceId;
        private String ligneId;
        private String medicamentId;

        public LignePrescriptionReference() {}

        @DynamoDbPartitionKey
        @DynamoDbAttribute("ordonnanceId")
        public String getOrdonnanceId() { return ordonnanceId; }
        public void setOrdonnanceId(String ordonnanceId) { this.ordonnanceId = ordonnanceId; }

        @software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSortKey
        @DynamoDbAttribute("ligneId")
        public String getLigneId() { return ligneId; }
        public void setLigneId(String ligneId) { this.ligneId = ligneId; }

        @DynamoDbAttribute("medicamentId")
        public String getMedicamentId() { return medicamentId; }
        public void setMedicamentId(String medicamentId) { this.medicamentId = medicamentId; }
    }

    @DynamoDbBean
    public static class MedicamentReference {
        private String medicamentId;
        private String nom;
        private String substanceActive;

        public MedicamentReference() {}

        @DynamoDbPartitionKey
        @DynamoDbAttribute("medicamentId")
        public String getMedicamentId() { return medicamentId; }
        public void setMedicamentId(String medicamentId) { this.medicamentId = medicamentId; }

        @DynamoDbAttribute("nom")
        public String getNom() { return nom; }
        public void setNom(String nom) { this.nom = nom; }

        @DynamoDbAttribute("substanceActive")
        public String getSubstanceActive() { return substanceActive; }
        public void setSubstanceActive(String substanceActive) { this.substanceActive = substanceActive; }
    }
}
