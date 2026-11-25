package com.healthtrack.ordonnances.repository;
import com.healthtrack.ordonnances.model.LignePrescription;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface LignePrescriptionRepository extends JpaRepository<LignePrescription, String> {
    List<LignePrescription> findByOrdonnanceId(String ordonnanceId);
    void deleteByOrdonnanceId(String ordonnanceId);
}
