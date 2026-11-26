package com.healthtrack.ordonnances.repository;

import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryConditional;

import java.util.Optional;

/**
 * Lecture seule de la table des rendez-vous (propriété de l'API RDV) :
 * vérifie qu'une consultation est TERMINE et qui l'a réalisée avant d'émettre une ordonnance.
 */
@Repository
public class RendezVousRepository {
    private final DynamoDbTable<RendezVousReference> table;

    public RendezVousRepository(DynamoDbEnhancedClient client) {
        this.table = client.table("healthtrack-rendezvous", TableSchema.fromBean(RendezVousReference.class));
    }

    public Optional<RendezVousReference> findById(String rdvId) {
        return Optional.ofNullable(table.getItem(Key.builder().partitionValue(rdvId).build()));
    }

    /** Vrai si le praticien a déjà eu une consultation (TERMINE ou EN_COURS) avec ce patient. */
    public boolean hasConsulted(String patientId, String praticienId) {
        for (var page : table.index("byPatientAndDate").query(QueryConditional.keyEqualTo(Key.builder().partitionValue(patientId).build()))) {
            if (page.items().stream().anyMatch(r -> praticienId.equals(r.getPraticienId())
                && ("TERMINE".equals(r.getStatut()) || "EN_COURS".equals(r.getStatut())))) return true;
        }
        return false;
    }

    @DynamoDbBean
    public static class RendezVousReference {
        private String rdvId;
        private String patientId;
        private String praticienId;
        private String date;
        private String statut;
        private String patientNom;
        private String praticienNom;

        @DynamoDbPartitionKey @DynamoDbAttribute("rdvId")
        public String getRdvId() { return rdvId; }
        public void setRdvId(String v) { rdvId = v; }
        @DynamoDbSecondaryPartitionKey(indexNames = "byPatientAndDate") @DynamoDbAttribute("patientId")
        public String getPatientId() { return patientId; }
        public void setPatientId(String v) { patientId = v; }
        @DynamoDbAttribute("praticienId")
        public String getPraticienId() { return praticienId; }
        public void setPraticienId(String v) { praticienId = v; }
        @DynamoDbSecondarySortKey(indexNames = "byPatientAndDate") @DynamoDbAttribute("date")
        public String getDate() { return date; }
        public void setDate(String v) { date = v; }
        @DynamoDbAttribute("statut")
        public String getStatut() { return statut; }
        public void setStatut(String v) { statut = v; }
        @DynamoDbAttribute("patientNom")
        public String getPatientNom() { return patientNom; }
        public void setPatientNom(String v) { patientNom = v; }
        @DynamoDbAttribute("praticienNom")
        public String getPraticienNom() { return praticienNom; }
        public void setPraticienNom(String v) { praticienNom = v; }
    }
}
