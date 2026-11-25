package com.healthtrack.dossiers.service;

import com.healthtrack.dossiers.dto.*;
import com.healthtrack.dossiers.exception.ApiException;
import com.healthtrack.dossiers.model.*;
import com.healthtrack.dossiers.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class DossierService {
    private static final Logger log = LoggerFactory.getLogger(DossierService.class);

    private final DossierRepository dossierRepo;
    private final AntecedentRepository antecedentRepo;
    private final AllergieRepository allergieRepo;
    private final VaccinationRepository vaccinationRepo;

    public DossierService(DossierRepository dossierRepo, AntecedentRepository antecedentRepo,
                          AllergieRepository allergieRepo, VaccinationRepository vaccinationRepo) {
        this.dossierRepo = dossierRepo; this.antecedentRepo = antecedentRepo;
        this.allergieRepo = allergieRepo; this.vaccinationRepo = vaccinationRepo;
    }

    private void checkAccess(String patientId, String userId, String userType) {
        if ("PATIENT".equals(userType) && !userId.equals(patientId))
            throw new ApiException("AccessDeniedException", "Accès refusé", 403);
        // Pour praticien: vérifier via RDV TERMINE (simplifié ici - en prod appeler l'API RDV)
        if ("PRATICIEN".equals(userType) && !userId.equals(patientId))
            log.info("Vérification accès praticien {} pour patient {}", userId, patientId);
    }

    public DossierComplet getDossierComplet(String patientId, String userId, String userType) {
        checkAccess(patientId, userId, userType);
        DossierMedical dossier = dossierRepo.findById(patientId)
            .orElseGet(() -> {
                if (userId.equals(patientId)) {
                    DossierMedical d = new DossierMedical();
                    d.setPatientId(patientId); d.setGroupeSanguin("");
                    return dossierRepo.save(d);
                }
                throw new ApiException("NotFound", "Dossier non trouvé", 404);
            });
        return new DossierComplet(dossier,
            antecedentRepo.findByDossierId(patientId),
            allergieRepo.findByPatientId(patientId),
            vaccinationRepo.findByDossierId(patientId));
    }

    public Antecedent createAntecedent(String dossierId, AntecedentRequest req, String userId, String userType) {
        checkAccess(dossierId, userId, userType);
        if (!dossierRepo.existsById(dossierId))
            throw new ApiException("NotFound", "Dossier non trouvé", 404);
        Antecedent a = new Antecedent();
        a.setAntecedentId(UUID.randomUUID().toString());
        a.setDossierId(dossierId);
        a.setLibelle(req.libelle());
        a.setType(AntecedentType.valueOf(req.type()));
        a.setDate(req.date() != null ? req.date() : java.time.Instant.now().toString());
        a.setStatut(AntecedentStatut.ACTIF);
        a.setDescription(req.description() != null ? req.description() : "");
        return antecedentRepo.save(a);
    }

    public Antecedent updateAntecedent(String id, AntecedentUpdate req, String userId, String userType) {
        Antecedent a = antecedentRepo.findById(id).orElseThrow(() -> new ApiException("NotFound", "Antécédent non trouvé", 404));
        checkAccess(a.getDossierId(), userId, userType);
        if (req.libelle() != null) a.setLibelle(req.libelle());
        if (req.date() != null) a.setDate(req.date());
        if (req.description() != null) a.setDescription(req.description());
        return antecedentRepo.save(a);
    }

    public Antecedent archiveAntecedent(String id, String userId, String userType) {
        Antecedent a = antecedentRepo.findById(id).orElseThrow(() -> new ApiException("NotFound", "Antécédent non trouvé", 404));
        checkAccess(a.getDossierId(), userId, userType);
        if (a.getType() == AntecedentType.CHRONIQUE)
            throw new ApiException("ChronicConditionCannotBeArchivedException", "Antécédent chronique non archivable", 409);
        a.setStatut(AntecedentStatut.ARCHIVE);
        return antecedentRepo.save(a);
    }

    public List<Antecedent> listAntecedents(String patientId, String userId, String userType) {
        checkAccess(patientId, userId, userType);
        return antecedentRepo.findByDossierId(patientId);
    }

    public Allergie createAllergie(String dossierId, AllergieRequest req, String userId, String userType) {
        checkAccess(dossierId, userId, userType);
        Allergie a = new Allergie();
        a.setAllergieId(UUID.randomUUID().toString());
        a.setPatientId(dossierId);
        a.setMedicamentConcerne(req.medicamentConcerne());
        a.setSeverite(AllergieSeverite.valueOf(req.severite()));
        a.setDateDecouverte(req.dateDecouverte() != null ? req.dateDecouverte() : java.time.Instant.now().toString());
        a.setDescription(req.description() != null ? req.description() : "");
        Allergie saved = allergieRepo.save(a);
        log.info("{{\"event\":\"ALLERGIE_CREATED\",\"allergieId\":\"{}\",\"patientId\":\"{}\",\"praticien\":\"{}\"}}", saved.getAllergieId(), dossierId, userId);
        return saved;
    }

    public void deleteAllergie(String id, String userId, String userType) {
        Allergie a = allergieRepo.findById(id).orElseThrow(() -> new ApiException("NotFound", "Allergie non trouvée", 404));
        checkAccess(a.getPatientId(), userId, userType);
        allergieRepo.deleteById(id);
        log.info("{{\"event\":\"ALLERGIE_DELETED\",\"allergieId\":\"{}\",\"praticien\":\"{}\"}}", id, userId);
    }

    public List<Allergie> listAllergies(String patientId, String userId, String userType) {
        checkAccess(patientId, userId, userType);
        return allergieRepo.findByPatientId(patientId);
    }

    public Vaccination createVaccination(String dossierId, VaccinationRequest req, String userId, String userType) {
        checkAccess(dossierId, userId, userType);
        if (!dossierRepo.existsById(dossierId))
            throw new ApiException("NotFound", "Dossier non trouvé", 404);
        Vaccination v = new Vaccination();
        v.setVaccinationId(UUID.randomUUID().toString());
        v.setDossierId(dossierId);
        v.setNomVaccin(req.nomVaccin());
        v.setDate(req.date());
        v.setRappelPrevu(req.rappelPrevu());
        v.setDescription(req.description() != null ? req.description() : "");
        return vaccinationRepo.save(v);
    }

    public List<Vaccination> listVaccinations(String patientId, String userId, String userType) {
        checkAccess(patientId, userId, userType);
        return vaccinationRepo.findByDossierId(patientId);
    }
}
