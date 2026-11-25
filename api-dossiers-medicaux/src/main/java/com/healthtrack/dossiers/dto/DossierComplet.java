package com.healthtrack.dossiers.dto;
import com.healthtrack.dossiers.model.*;
import java.util.List;
public record DossierComplet(DossierMedical dossier, List<Antecedent> antecedents, List<Allergie> allergies, List<Vaccination> vaccinations) {}
