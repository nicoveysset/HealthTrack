package com.healthtrack.rdv.repository;

import com.healthtrack.rdv.model.Disponibilite;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DisponibiliteRepository extends JpaRepository<Disponibilite, String> {
    List<Disponibilite> findByPraticienId(String praticienId);
    List<Disponibilite> findByPraticienIdAndJourSemaine(String praticienId, String jourSemaine);
    void deleteByPraticienId(String praticienId);
}
