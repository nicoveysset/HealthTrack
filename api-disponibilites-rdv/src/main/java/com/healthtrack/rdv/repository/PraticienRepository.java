package com.healthtrack.rdv.repository;

import com.healthtrack.rdv.model.PraticienReference;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;

import java.util.Optional;

@Repository
public class PraticienRepository {
    private final DynamoDbTable<PraticienReference> table;

    public PraticienRepository(DynamoDbEnhancedClient client) {
        this.table = client.table("healthtrack-utilisateurs", TableSchema.fromBean(PraticienReference.class));
    }

    public Optional<PraticienReference> findById(String id) {
        return Optional.ofNullable(table.getItem(Key.builder().partitionValue(id).build()));
    }
}
