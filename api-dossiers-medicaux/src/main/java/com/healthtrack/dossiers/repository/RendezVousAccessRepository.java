package com.healthtrack.dossiers.repository;

import com.healthtrack.dossiers.model.RendezVousReference;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryConditional;

@Repository
public class RendezVousAccessRepository {
    private final DynamoDbTable<RendezVousReference> table;

    public RendezVousAccessRepository(DynamoDbEnhancedClient client) {
        this.table = client.table("healthtrack-rendezvous", TableSchema.fromBean(RendezVousReference.class));
    }

    /** Vrai si le praticien a déjà reçu ce patient (consultation TERMINE) ou est en train de le recevoir (EN_COURS). */
    public boolean hasCompletedAppointment(String patientId, String praticienId) {
        var index = table.index("byPatientAndDate");
        for (var page : index.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(patientId).build()))) {
            if (page.items().stream().anyMatch(rdv ->
                praticienId.equals(rdv.getPraticienId())
                && ("TERMINE".equals(rdv.getStatut()) || "EN_COURS".equals(rdv.getStatut())))) {
                return true;
            }
        }
        return false;
    }
}
