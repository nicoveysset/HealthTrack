package com.healthtrack.dossiers.repository;
import com.healthtrack.dossiers.model.Vaccination;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface VaccinationRepository extends JpaRepository<Vaccination, String> {
    List<Vaccination> findByDossierId(String dossierId);
}
