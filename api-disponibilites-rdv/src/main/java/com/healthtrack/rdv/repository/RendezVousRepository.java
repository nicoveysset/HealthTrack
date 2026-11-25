package com.healthtrack.rdv.repository;

import com.healthtrack.rdv.model.RendezVous;
import com.healthtrack.rdv.model.RendezVousStatut;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RendezVousRepository extends JpaRepository<RendezVous, String> {
    Page<RendezVous> findByPraticienId(String praticienId, Pageable pageable);
    Page<RendezVous> findByPatientId(String patientId, Pageable pageable);
    Page<RendezVous> findByPraticienIdAndStatut(String praticienId, RendezVousStatut statut, Pageable pageable);
    Page<RendezVous> findByPatientIdAndStatut(String patientId, RendezVousStatut statut, Pageable pageable);
    List<RendezVous> findByPraticienIdAndDateBetween(String praticienId, String dateDebut, String dateFin);
    List<RendezVous> findByPraticienIdAndDate(String praticienId, String date);
}
