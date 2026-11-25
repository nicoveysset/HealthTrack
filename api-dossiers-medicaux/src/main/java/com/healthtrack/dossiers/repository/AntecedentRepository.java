package com.healthtrack.dossiers.repository;
import com.healthtrack.dossiers.model.Antecedent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface AntecedentRepository extends JpaRepository<Antecedent, String> {
    List<Antecedent> findByDossierId(String dossierId);
}
