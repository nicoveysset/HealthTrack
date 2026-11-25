package com.healthtrack.rdv.repository;

import com.healthtrack.rdv.model.Disponibilite;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.*;
import software.amazon.awssdk.enhanced.dynamodb.model.*;
import java.util.*;

@Repository
public class DisponibiliteRepository {
    private final DynamoDbTable<Disponibilite> table;
    public DisponibiliteRepository(DynamoDbEnhancedClient ec) {
        this.table = ec.table("healthtrack-disponibilites", TableSchema.fromBean(Disponibilite.class));
    }
    public Disponibilite save(Disponibilite d) { table.putItem(d); return d; }
    public List<Disponibilite> findByPraticienId(String pid) {
        var idx = table.index("byPraticien");
        List<Disponibilite> out = new ArrayList<>();
        for (var p : idx.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(pid).build()))) out.addAll(p.items());
        return out;
    }
    public List<Disponibilite> findByPraticienIdAndJour(String pid, String jour) {
        return findByPraticienId(pid).stream().filter(d -> d.getJourSemaine().equals(jour)).toList();
    }
    public void deleteByPraticienId(String pid) {
        findByPraticienId(pid).forEach(d -> table.deleteItem(Key.builder().partitionValue(d.getDispoId()).build()));
    }
    public void deleteById(String id) { table.deleteItem(Key.builder().partitionValue(id).build()); }
}
