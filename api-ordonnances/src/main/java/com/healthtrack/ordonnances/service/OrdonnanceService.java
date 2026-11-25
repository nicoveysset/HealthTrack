package com.healthtrack.ordonnances.service;

import com.healthtrack.ordonnances.dto.*;
import com.healthtrack.ordonnances.exception.ApiException;
import com.healthtrack.ordonnances.model.*;
import com.healthtrack.ordonnances.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class OrdonnanceService {
    private static final Logger log = LoggerFactory.getLogger(OrdonnanceService.class);

    private final OrdonnanceRepository ordonnanceRepo;
    private final LignePrescriptionRepository ligneRepo;
    private final MedicamentRepository medicamentRepo;

    public OrdonnanceService(OrdonnanceRepository ordonnanceRepo, LignePrescriptionRepository ligneRepo,
                             MedicamentRepository medicamentRepo) {
        this.ordonnanceRepo = ordonnanceRepo; this.ligneRepo = ligneRepo; this.medicamentRepo = medicamentRepo;
    }

    /** Expiration paresseuse */
    private Ordonnance checkExpiration(Ordonnance o) {
        if (o.getStatut() == OrdonnanceStatut.ACTIVE && o.getDateValidite() != null) {
            LocalDateTime validite = LocalDateTime.parse(o.getDateValidite());
            if (validite.isBefore(LocalDateTime.now(ZoneOffset.UTC)) && o.getStatut() == OrdonnanceStatut.ACTIVE) {
                o.setStatut(OrdonnanceStatut.EXPIREE);
                o = ordonnanceRepo.save(o);
                log.info("Ordonnance {} passée EXPIREE (expiration paresseuse)", o.getOrdonnanceId());
            }
        }
        return o;
    }

    public Ordonnance createOrdonnance(String compteRenduId, String praticienId, String patientId) {
        if (ordonnanceRepo.existsByCompteRenduId(compteRenduId))
            throw new ApiException("ConsultationNotFinalizedException", "Une ordonnance existe déjà pour ce compte rendu", 409);
        Ordonnance o = new Ordonnance();
        o.setOrdonnanceId(UUID.randomUUID().toString());
        o.setCompteRenduId(compteRenduId);
        o.setPatientId(patientId);
        o.setPraticienId(praticienId);
        o.setDateEmission(Instant.now().toString());
        o.setDateValidite(LocalDateTime.now(ZoneOffset.UTC).plusMonths(3).toString());
        o.setStatut(OrdonnanceStatut.ACTIVE);
        return ordonnanceRepo.save(o);
    }

    @Transactional(readOnly = true)
    public OrdonnanceAvecLignes getOrdonnance(String id, String userId) {
        Ordonnance o = ordonnanceRepo.findById(id).orElseThrow(() -> new ApiException("NotFound", "Ordonnance non trouvée", 404));
        o = checkExpiration(o);
        if (!o.getPatientId().equals(userId) && !o.getPraticienId().equals(userId))
            throw new ApiException("Forbidden", "Non autorisé", 403);
        return new OrdonnanceAvecLignes(o, ligneRepo.findByOrdonnanceId(id));
    }

    @Transactional(readOnly = true)
    public PagedResponse<Ordonnance> listOrdonnances(String userId, String userType, String patientIdFilter, int page, int limit) {
        PageRequest pr = PageRequest.of(page - 1, limit);
        Page<Ordonnance> result;
        if ("PATIENT".equals(userType)) {
            result = ordonnanceRepo.findByPatientId(userId, pr);
        } else if (patientIdFilter != null) {
            result = ordonnanceRepo.findByPatientId(patientIdFilter, pr);
        } else {
            result = ordonnanceRepo.findByPraticienId(userId, pr);
        }
        var items = result.getContent().stream().map(this::checkExpiration).toList();
        return new PagedResponse<>(items, result.getTotalElements(), page, limit);
    }

    public LignePrescription addLigne(String ordonnanceId, LigneRequest req, String userId) {
        Ordonnance o = ordonnanceRepo.findById(ordonnanceId).orElseThrow(() -> new ApiException("NotFound", "Ordonnance non trouvée", 404));
        o = checkExpiration(o);
        if (o.getStatut() == OrdonnanceStatut.EXPIREE)
            throw new ApiException("PrescriptionExpiredException", "L'ordonnance est expirée", 409);
        if (!o.getPraticienId().equals(userId))
            throw new ApiException("Forbidden", "Seul le praticien peut ajouter des lignes", 403);
        if (!medicamentRepo.existsById(req.medicamentId()))
            throw new ApiException("NotFound", "Médicament non trouvé", 404);
        // TODO: vérifier conflit allergie via API dossiers
        LignePrescription l = new LignePrescription();
        l.setLigneId(UUID.randomUUID().toString());
        l.setOrdonnanceId(ordonnanceId);
        l.setMedicamentId(req.medicamentId());
        l.setPosologie(req.posologie());
        l.setDuree(req.duree() != null ? req.duree() : 0);
        l.setInstructions(req.instructions() != null ? req.instructions() : "");
        if (l.getDuree() != null && l.getDuree() > 90)
            log.info("Prescription durée > 90 jours: ordonnance={}, duree={}", ordonnanceId, l.getDuree());
        return ligneRepo.save(l);
    }

    public void deleteLigne(String ordonnanceId, String ligneId, String userId) {
        Ordonnance o = ordonnanceRepo.findById(ordonnanceId).orElseThrow(() -> new ApiException("NotFound", "Ordonnance non trouvée", 404));
        if (!o.getPraticienId().equals(userId))
            throw new ApiException("Forbidden", "Seul le praticien peut supprimer des lignes", 403);
        ligneRepo.deleteById(ligneId);
    }

    @Transactional(readOnly = true)
    public List<LignePrescription> listLignes(String ordonnanceId, String userId) {
        Ordonnance o = ordonnanceRepo.findById(ordonnanceId).orElseThrow(() -> new ApiException("NotFound", "Ordonnance non trouvée", 404));
        if (!o.getPatientId().equals(userId) && !o.getPraticienId().equals(userId))
            throw new ApiException("Forbidden", "Non autorisé", 403);
        return ligneRepo.findByOrdonnanceId(ordonnanceId);
    }

    @Transactional(readOnly = true)
    public PagedResponse<Medicament> listMedicaments(String forme, String search, int page, int limit) {
        PageRequest pr = PageRequest.of(page - 1, limit);
        if (forme != null) {
            Page<Medicament> r = medicamentRepo.findByForme(MedicamentForme.valueOf(forme), pr);
            return new PagedResponse<>(r.getContent(), r.getTotalElements(), page, limit);
        }
        var all = medicamentRepo.findAll(pr);
        return new PagedResponse<>(all.getContent(), all.getTotalElements(), page, limit);
    }

    public Medicament createMedicament(MedicamentRequest req) {
        if (medicamentRepo.existsByNom(req.nom()))
            throw new ApiException("Conflict", "Médicament déjà existant", 409);
        Medicament m = new Medicament();
        m.setMedicamentId(UUID.randomUUID().toString());
        m.setNom(req.nom());
        m.setSubstanceActive(req.substanceActive() != null ? req.substanceActive() : "");
        m.setForme(MedicamentForme.valueOf(req.forme()));
        m.setDescription(req.description() != null ? req.description() : "");
        return medicamentRepo.save(m);
    }
}
