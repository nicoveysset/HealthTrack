package com.healthtrack.rdv.repository;

import com.healthtrack.rdv.model.CompteRendu;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CompteRenduRepository extends JpaRepository<CompteRendu, String> {
    Optional<CompteRendu> findByRdvId(String rdvId);
    boolean existsByRdvId(String rdvId);
}
