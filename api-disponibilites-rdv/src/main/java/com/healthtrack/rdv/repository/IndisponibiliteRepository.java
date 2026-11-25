package com.healthtrack.rdv.repository;

import com.healthtrack.rdv.model.Indisponibilite;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.*;
import software.amazon.awssdk.enhanced.dynamodb.model.*;
import java.util.*;

@Repository
public class IndisponibiliteRepository {
    private final DynamoDbTable<Indisponibilite> table;
    public IndisponibiliteRepository(DynamoDbEnhancedClient ec) {
        this.table = ec.table("healthtrack-indisponibilites", TableSchema.fromBean(Indisponibilite.class));
    }
    public Indisponibilite save(Indisponibilite i) { table.putItem(i); return i; }
    public Optional<Indisponibilite> findById(String id) { return Optional.ofNullable(table.getItem(Key.builder().partitionValue(id).build())); }
    public List<Indisponibilite> findByPraticienId(String pid) {
        var idx = table.index("byPraticien");
        List<Indisponibilite> out = new ArrayList<>();
        for (var p : idx.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(pid).build()))) out.addAll(p.items());
        return out;
    }
    public void deleteById(String id) { table.deleteItem(Key.builder().partitionValue(id).build()); }
    public boolean existsById(String id) { return findById(id).isPresent(); }
}
