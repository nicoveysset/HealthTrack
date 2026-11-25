package com.healthtrack.ordonnances.repository;
import com.healthtrack.ordonnances.model.Medicament;
import com.healthtrack.ordonnances.model.MedicamentForme;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface MedicamentRepository extends JpaRepository<Medicament, String> {
    Page<Medicament> findByForme(MedicamentForme forme, Pageable pageable);
    List<Medicament> findByNomContainingIgnoreCase(String nom);
    boolean existsByNom(String nom);
}
