package com.healthtrack.ordonnances.repository;
import com.healthtrack.ordonnances.model.Medicament;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.*;
import software.amazon.awssdk.enhanced.dynamodb.model.*;
import java.util.*;
@Repository
public class MedicamentRepository {
    private final DynamoDbTable<Medicament> table;
    public MedicamentRepository(DynamoDbEnhancedClient ec) { this.table = ec.table("healthtrack-medicaments", TableSchema.fromBean(Medicament.class)); }
    public Medicament save(Medicament m) { table.putItem(m); return m; }
    public Optional<Medicament> findById(String id) { return Optional.ofNullable(table.getItem(Key.builder().partitionValue(id).build())); }
    public boolean existsById(String id) { return findById(id).isPresent(); }
    public boolean existsByNom(String nom) {
        return table.scan().items().stream().anyMatch(m -> nom.equals(m.getNom()));
    }
    public List<Medicament> findAll() { List<Medicament> out = new ArrayList<>(); for (var p : table.scan()) out.addAll(p.items()); return out; }
    public List<Medicament> findByForme(String forme) {
        var idx = table.index("byForme");
        List<Medicament> out = new ArrayList<>();
        for (var p : idx.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(forme).build()))) out.addAll(p.items());
        return out;
    }
}
