package com.healthtrack.ordonnances.repository;
import com.healthtrack.ordonnances.model.Ordonnance;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
public interface OrdonnanceRepository extends JpaRepository<Ordonnance, String> {
    Page<Ordonnance> findByPatientId(String patientId, Pageable pageable);
    Page<Ordonnance> findByPraticienId(String praticienId, Pageable pageable);
    boolean existsByCompteRenduId(String compteRenduId);
}
