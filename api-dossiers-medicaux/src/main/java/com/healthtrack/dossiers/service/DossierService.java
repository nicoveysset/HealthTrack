package com.healthtrack.dossiers.service;

import com.healthtrack.dossiers.dto.*;
import com.healthtrack.dossiers.exception.ApiException;
import com.healthtrack.dossiers.model.*;
import com.healthtrack.dossiers.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class DossierService {
    private static final Logger log = LoggerFactory.getLogger(DossierService.class);
    private final DossierRepository dossierRepo;
    private final AntecedentRepository antecedentRepo;
    private final AllergieRepository allergieRepo;
    private final VaccinationRepository vaccinationRepo;

    public DossierService(DossierRepository d, AntecedentRepository a, AllergieRepository al, VaccinationRepository v) {
        this.dossierRepo = d; this.antecedentRepo = a; this.allergieRepo = al; this.vaccinationRepo = v;
    }

    private void checkAccess(String patientId, String userId, String userType) {
        if ("PATIENT".equals(userType) && !userId.equals(patientId))
            throw new ApiException("AccessDeniedException", "Accès refusé", 403);
    }

    public DossierComplet getDossierComplet(String patientId, String userId, String userType) {
        checkAccess(patientId, userId, userType);
        DossierMedical dossier = dossierRepo.findById(patientId).orElseGet(() -> {
            if (userId.equals(patientId)) {
                String now = Instant.now().toString();
                DossierMedical d = new DossierMedical();
                d.setPatientId(patientId); d.setGroupeSanguin(""); d.setDateCreation(now); d.setUpdatedAt(now);
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
        if (!dossierRepo.existsById(dossierId)) throw new ApiException("NotFound", "Dossier non trouvé", 404);
        String now = Instant.now().toString();
        Antecedent a = new Antecedent();
        a.setAntecedentId(UUID.randomUUID().toString()); a.setDossierId(dossierId);
        a.setLibelle(req.libelle()); a.setType(req.type());
        a.setDate(req.date() != null ? req.date() : now); a.setStatut("ACTIF");
        a.setDescription(req.description() != null ? req.description() : "");
        a.setCreatedAt(now); a.setUpdatedAt(now);
        return antecedentRepo.save(a);
    }

    public Antecedent updateAntecedent(String id, AntecedentUpdate req, String userId, String userType) {
        Antecedent a = antecedentRepo.findById(id).orElseThrow(() -> new ApiException("NotFound", "Antécédent non trouvé", 404));
        checkAccess(a.getDossierId(), userId, userType);
        if (req.libelle() != null) a.setLibelle(req.libelle());
        if (req.date() != null) a.setDate(req.date());
        if (req.description() != null) a.setDescription(req.description());
        a.setUpdatedAt(Instant.now().toString());
        return antecedentRepo.save(a);
    }

    public Antecedent archiveAntecedent(String id, String userId, String userType) {
        Antecedent a = antecedentRepo.findById(id).orElseThrow(() -> new ApiException("NotFound", "Antécédent non trouvé", 404));
        checkAccess(a.getDossierId(), userId, userType);
        if ("CHRONIQUE".equals(a.getType()))
            throw new ApiException("ChronicConditionCannotBeArchivedException", "Antécédent chronique non archivable", 409);
        a.setStatut("ARCHIVE"); a.setUpdatedAt(Instant.now().toString());
        return antecedentRepo.save(a);
    }

    public List<Antecedent> listAntecedents(String pid, String uid, String utype) { checkAccess(pid, uid, utype); return antecedentRepo.findByDossierId(pid); }

    public Allergie createAllergie(String dossierId, AllergieRequest req, String userId, String userType) {
        checkAccess(dossierId, userId, userType);
        String now = Instant.now().toString();
        Allergie a = new Allergie();
        a.setAllergieId(UUID.randomUUID().toString()); a.setPatientId(dossierId);
        a.setMedicamentConcerne(req.medicamentConcerne()); a.setSeverite(req.severite());
        a.setDateDecouverte(req.dateDecouverte() != null ? req.dateDecouverte() : now);
        a.setDescription(req.description() != null ? req.description() : "");
        a.setCreatedAt(now); a.setUpdatedAt(now);
        Allergie saved = allergieRepo.save(a);
        log.info("{\"event\":\"ALLERGIE_CREATED\",\"allergieId\":\"{}\",\"patientId\":\"{}\"}", saved.getAllergieId(), dossierId);
        return saved;
    }

    public void deleteAllergie(String id, String userId, String userType) {
        Allergie a = allergieRepo.findById(id).orElseThrow(() -> new ApiException("NotFound", "Allergie non trouvée", 404));
        checkAccess(a.getPatientId(), userId, userType);
        allergieRepo.deleteById(id);
        log.info("{\"event\":\"ALLERGIE_DELETED\",\"allergieId\":\"{}\"}", id);
    }

    public List<Allergie> listAllergies(String pid, String uid, String utype) { checkAccess(pid, uid, utype); return allergieRepo.findByPatientId(pid); }

    public Vaccination createVaccination(String dossierId, VaccinationRequest req, String userId, String userType) {
        checkAccess(dossierId, userId, userType);
        if (!dossierRepo.existsById(dossierId)) throw new ApiException("NotFound", "Dossier non trouvé", 404);
        String now = Instant.now().toString();
        Vaccination v = new Vaccination();
        v.setVaccinationId(UUID.randomUUID().toString()); v.setDossierId(dossierId);
        v.setNomVaccin(req.nomVaccin()); v.setDate(req.date()); v.setRappelPrevu(req.rappelPrevu());
        v.setDescription(req.description() != null ? req.description() : "");
        v.setCreatedAt(now); v.setUpdatedAt(now);
        return vaccinationRepo.save(v);
    }

    public List<Vaccination> listVaccinations(String pid, String uid, String utype) { checkAccess(pid, uid, utype); return vaccinationRepo.findByDossierId(pid); }
}
