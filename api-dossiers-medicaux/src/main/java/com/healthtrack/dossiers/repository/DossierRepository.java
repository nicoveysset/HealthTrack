package com.healthtrack.dossiers.repository;
import com.healthtrack.dossiers.model.DossierMedical;
import org.springframework.data.jpa.repository.JpaRepository;
public interface DossierRepository extends JpaRepository<DossierMedical, String> {}
