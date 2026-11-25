package com.healthtrack.dossiers.repository;
import com.healthtrack.dossiers.model.Antecedent;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.*;
import software.amazon.awssdk.enhanced.dynamodb.model.*;
import java.util.*;
@Repository
public class AntecedentRepository {
    private final DynamoDbTable<Antecedent> table;
    public AntecedentRepository(DynamoDbEnhancedClient ec) { this.table = ec.table("healthtrack-antecedents", TableSchema.fromBean(Antecedent.class)); }
    public Antecedent save(Antecedent item) { table.putItem(item); return item; }
    public Optional<Antecedent> findById(String id) { return Optional.ofNullable(table.getItem(Key.builder().partitionValue(id).build())); }
    public boolean existsById(String id) { return findById(id).isPresent(); }
    public void deleteById(String id) { table.deleteItem(Key.builder().partitionValue(id).build()); }
    public List<Antecedent> findByDossierId(String val) {
        var i = table.index("byDossier");
        List<Antecedent> out = new ArrayList<>();
        for (var p : i.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(val).build()))) out.addAll(p.items());
        return out;
    }
}
