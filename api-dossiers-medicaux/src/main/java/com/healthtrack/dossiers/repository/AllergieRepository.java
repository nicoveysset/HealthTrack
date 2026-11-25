package com.healthtrack.dossiers.repository;
import com.healthtrack.dossiers.model.Allergie;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface AllergieRepository extends JpaRepository<Allergie, String> {
    List<Allergie> findByPatientId(String patientId);
}
