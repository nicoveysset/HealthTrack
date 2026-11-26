package com.healthtrack.ordonnances.repository;
import com.healthtrack.ordonnances.model.Ordonnance;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.*;
import software.amazon.awssdk.enhanced.dynamodb.model.*;
import java.util.*;
@Repository
public class OrdonnanceRepository {
    private final DynamoDbTable<Ordonnance> table;
    public OrdonnanceRepository(DynamoDbEnhancedClient ec) { this.table = ec.table("healthtrack-ordonnances", TableSchema.fromBean(Ordonnance.class)); }
    public Ordonnance save(Ordonnance o) { table.putItem(o); return o; }
    public Optional<Ordonnance> findById(String id) { return Optional.ofNullable(table.getItem(Key.builder().partitionValue(id).build())); }
    public boolean existsByCompteRenduId(String crId) {
        var idx = table.index("byCompteRendu");
        for (var page : idx.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(crId).build()))) { if (!page.items().isEmpty()) return true; } return false;
    }
    public Optional<Ordonnance> findByRdvId(String rdvId) {
        var idx = table.index("byRendezVous");
        for (var p : idx.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(rdvId).build()))) {
            var first = p.items().stream().findFirst();
            if (first.isPresent()) return first;
        }
        return Optional.empty();
    }
    public List<Ordonnance> findByPatient(String pid) {
        var idx = table.index("byPatientAndDate");
        List<Ordonnance> out = new ArrayList<>();
        for (var p : idx.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(pid).build()))) out.addAll(p.items());
        return out;
    }
    public List<Ordonnance> findByPraticien(String pid) {
        // Scan filtré (pas de GSI byPraticien dans le schéma original)
        List<Ordonnance> out = new ArrayList<>();
        for (var p : table.scan()) p.items().stream().filter(o -> pid.equals(o.getPraticienId())).forEach(out::add);
        return out;
    }
}
