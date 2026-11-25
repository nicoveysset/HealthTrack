package com.healthtrack.dossiers.repository;
import com.healthtrack.dossiers.model.Vaccination;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.*;
import software.amazon.awssdk.enhanced.dynamodb.model.*;
import java.util.*;
@Repository
public class VaccinationRepository {
    private final DynamoDbTable<Vaccination> table;
    public VaccinationRepository(DynamoDbEnhancedClient ec) { this.table = ec.table("healthtrack-vaccinations", TableSchema.fromBean(Vaccination.class)); }
    public Vaccination save(Vaccination item) { table.putItem(item); return item; }
    public Optional<Vaccination> findById(String id) { return Optional.ofNullable(table.getItem(Key.builder().partitionValue(id).build())); }
    public boolean existsById(String id) { return findById(id).isPresent(); }
    public void deleteById(String id) { table.deleteItem(Key.builder().partitionValue(id).build()); }
    public List<Vaccination> findByDossierId(String val) {
        var i = table.index("byDossier");
        List<Vaccination> out = new ArrayList<>();
        for (var p : i.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(val).build()))) out.addAll(p.items());
        return out;
    }
}
