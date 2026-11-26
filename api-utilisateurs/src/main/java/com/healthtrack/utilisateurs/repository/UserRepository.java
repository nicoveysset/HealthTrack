package com.healthtrack.utilisateurs.repository;

import com.healthtrack.utilisateurs.model.User;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.*;
import software.amazon.awssdk.enhanced.dynamodb.model.*;
import java.util.*;
import java.util.stream.Collectors;

@Repository
public class UserRepository {

    private static final String TABLE = "healthtrack-utilisateurs";
    private final DynamoDbTable<User> table;

    public UserRepository(DynamoDbEnhancedClient enhancedClient) {
        this.table = enhancedClient.table(TABLE, TableSchema.fromBean(User.class));
    }

    public User save(User user) {
        table.putItem(user);
        return user;
    }

    public Optional<User> findById(String userId) {
        return Optional.ofNullable(table.getItem(Key.builder().partitionValue(userId).build()));
    }

    public Optional<User> findByEmail(String email) {
        DynamoDbIndex<User> index = table.index("byEmail");
        for (var page : index.query(QueryConditional.keyEqualTo(Key.builder().partitionValue(email).build()))) {
            var found = page.items().stream().findFirst();
            if (found.isPresent()) return found;
        }
        return Optional.empty();
    }

    public boolean existsByEmail(String email) {
        return findByEmail(email).isPresent();
    }

    public User update(String userId, Map<String, Object> updates) {
        User user = findById(userId).orElseThrow();
        updates.forEach((k, v) -> {
            switch (k) {
                case "firstName" -> user.setFirstName((String) v);
                case "lastName" -> user.setLastName((String) v);
                case "name" -> user.setName((String) v);
                case "dateNaissance" -> user.setDateNaissance((String) v);
                case "nss" -> user.setNss((String) v);
                case "specialite" -> user.setSpecialite((String) v);
                case "rpps" -> user.setRpps((String) v);
                case "statut" -> user.setStatut((String) v);
                case "medecinTraitantId" -> user.setMedecinTraitantId((String) v);
            }
        });
        user.setUpdatedAt(java.time.Instant.now().toString());
        table.putItem(user);
        return user;
    }

    /** Tous les praticiens correspondant aux filtres (la pagination est faite par le service). */
    public List<User> findPraticiens(String specialite, String statut) {
        List<User> all = new ArrayList<>();
        for (var p : table.scan()) {
            all.addAll(p.items().stream()
                .filter(u -> "PRATICIEN".equals(u.getType()))
                .filter(u -> specialite == null || specialite.equalsIgnoreCase(u.getSpecialite()))
                .filter(u -> statut == null || statut.equalsIgnoreCase(u.getStatut()))
                .collect(Collectors.toList()));
        }
        return all;
    }

    public long countPraticiens() {
        var scan = table.scan();
        return scan.items().stream().filter(u -> "PRATICIEN".equals(u.getType())).count();
    }
}
