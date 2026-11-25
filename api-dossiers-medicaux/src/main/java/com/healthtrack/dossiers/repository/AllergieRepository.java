package com.healthtrack.dossiers.repository;
import com.healthtrack.dossiers.model.Allergie;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.*;
import software.amazon.awssdk.enhanced.dynamodb.model.*;
import java.util.*;
@Repository
public class AllergieRepository {
    private final DynamoDbTable<Allergie> table;
    public AllergieRepository(DynamoDbEnhancedClient ec) { this.table = ec.table("healthtrack-allergies", TableSchema.fromBean(Allergie.class)); }
    public Allergie save(Allergie item) { table.putItem(item); return item; }
    public Optional<Allergie> findById(String id) { return Optional.ofNullable(table.getItem(Key.builder().partitionValue(id).build())); }
    public boolean existsById(String id) { return findById(id).isPresent(); }
    public void deleteById(String id) { table.deleteItem(Key.builder().partitionValue(id).build()); }
    public List<Allergie> findByPatientId(String val) {
        var i = table.index("byPatient");
        List<Allergie> out = new ArrayList<>();
        for (var p : i.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(val).build()))) out.addAll(p.items());
        return out;
    }
}
