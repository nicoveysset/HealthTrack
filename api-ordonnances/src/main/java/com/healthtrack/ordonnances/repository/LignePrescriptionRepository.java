package com.healthtrack.ordonnances.repository;
import com.healthtrack.ordonnances.model.LignePrescription;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.*;
import software.amazon.awssdk.enhanced.dynamodb.model.*;
import java.util.*;
@Repository
public class LignePrescriptionRepository {
    private final DynamoDbTable<LignePrescription> table;
    public LignePrescriptionRepository(DynamoDbEnhancedClient ec) { this.table = ec.table("healthtrack-lignes-prescription", TableSchema.fromBean(LignePrescription.class)); }
    public LignePrescription save(LignePrescription l) { table.putItem(l); return l; }
    public Optional<LignePrescription> findById(String ordId, String ligneId) {
        return Optional.ofNullable(table.getItem(Key.builder().partitionValue(ordId).sortValue(ligneId).build()));
    }
    public List<LignePrescription> findByOrdonnanceId(String ordId) {
        List<LignePrescription> out = new ArrayList<>();
        for (var p : table.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(ordId).build()))) out.addAll(p.items());
        return out;
    }
    public void deleteById(String ordId, String ligneId) { table.deleteItem(Key.builder().partitionValue(ordId).sortValue(ligneId).build()); }
}
