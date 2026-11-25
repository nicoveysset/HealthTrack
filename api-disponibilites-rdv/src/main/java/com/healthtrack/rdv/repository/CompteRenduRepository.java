package com.healthtrack.rdv.repository;

import com.healthtrack.rdv.model.CompteRendu;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.*;
import software.amazon.awssdk.enhanced.dynamodb.model.*;
import java.util.*;

@Repository
public class CompteRenduRepository {
    private final DynamoDbTable<CompteRendu> table;
    public CompteRenduRepository(DynamoDbEnhancedClient ec) {
        this.table = ec.table("healthtrack-comptes-rendus", TableSchema.fromBean(CompteRendu.class));
    }
    public CompteRendu save(CompteRendu cr) { table.putItem(cr); return cr; }
    public Optional<CompteRendu> findById(String id) { return Optional.ofNullable(table.getItem(Key.builder().partitionValue(id).build())); }
    public Optional<CompteRendu> findByRdvId(String rdvId) {
        var idx = table.index("byRdv");
        for (var page : idx.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(rdvId).build()))) {
            var found = page.items().stream().findFirst();
            if (found.isPresent()) return found;
        }
        return Optional.empty();
    }
    public boolean existsByRdvId(String rdvId) { return findByRdvId(rdvId).isPresent(); }
}
