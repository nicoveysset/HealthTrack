package com.healthtrack.dossiers.repository;
import com.healthtrack.dossiers.model.DossierMedical;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.*;
import software.amazon.awssdk.enhanced.dynamodb.model.*;
import java.util.*;
@Repository
public class DossierRepository {
    private final DynamoDbTable<DossierMedical> table;
    public DossierRepository(DynamoDbEnhancedClient ec) { this.table = ec.table("healthtrack-dossiers-medicaux", TableSchema.fromBean(DossierMedical.class)); }
    public DossierMedical save(DossierMedical item) { table.putItem(item); return item; }
    public Optional<DossierMedical> findById(String id) { return Optional.ofNullable(table.getItem(Key.builder().partitionValue(id).build())); }
    public boolean existsById(String id) { return findById(id).isPresent(); }
    public void deleteById(String id) { table.deleteItem(Key.builder().partitionValue(id).build()); }
}
