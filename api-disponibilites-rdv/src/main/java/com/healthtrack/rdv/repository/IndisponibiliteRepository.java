package com.healthtrack.rdv.repository;

import com.healthtrack.rdv.model.Indisponibilite;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IndisponibiliteRepository extends JpaRepository<Indisponibilite, String> {
    List<Indisponibilite> findByPraticienId(String praticienId);
}
