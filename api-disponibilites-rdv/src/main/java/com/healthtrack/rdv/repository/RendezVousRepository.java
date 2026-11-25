package com.healthtrack.rdv.repository;

import com.healthtrack.rdv.model.RendezVous;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.*;
import software.amazon.awssdk.enhanced.dynamodb.model.*;
import java.util.*;

@Repository
public class RendezVousRepository {
    private final DynamoDbTable<RendezVous> table;
    public RendezVousRepository(DynamoDbEnhancedClient ec) {
        this.table = ec.table("healthtrack-rendezvous", TableSchema.fromBean(RendezVous.class));
    }
    public RendezVous save(RendezVous r) { table.putItem(r); return r; }
    public Optional<RendezVous> findById(String id) { return Optional.ofNullable(table.getItem(Key.builder().partitionValue(id).build())); }

    public List<RendezVous> findByPraticienIdAndDate(String pid, String date) {
        var idx = table.index("byPraticienAndDate");
        List<RendezVous> out = new ArrayList<>();
        for (var p : idx.query(QueryConditional.sortBeginsWith(Key.builder().partitionValue(pid).sortValue(date).build())))
            out.addAll(p.items());
        return out;
    }
    public List<RendezVous> findByPraticienIdAndDateBetween(String pid, String d1, String d2) {
        var idx = table.index("byPraticienAndDate");
        List<RendezVous> out = new ArrayList<>();
        for (var p : idx.query(QueryConditional.sortBetween(Key.builder().partitionValue(pid).sortValue(d1).build(), Key.builder().partitionValue(pid).sortValue(d2).build())))
            out.addAll(p.items());
        return out;
    }
    public List<RendezVous> findByPraticien(String pid) {
        var idx = table.index("byPraticienAndDate");
        List<RendezVous> out = new ArrayList<>();
        for (var p : idx.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(pid).build())))
            out.addAll(p.items());
        return out;
    }
    public List<RendezVous> findByPatient(String pid) {
        var idx = table.index("byPatientAndDate");
        List<RendezVous> out = new ArrayList<>();
        for (var p : idx.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(pid).build())))
            out.addAll(p.items());
        return out;
    }
}
