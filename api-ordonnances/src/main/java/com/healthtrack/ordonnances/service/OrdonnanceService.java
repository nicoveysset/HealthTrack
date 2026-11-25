package com.healthtrack.ordonnances.service;

import com.healthtrack.ordonnances.dto.*;
import com.healthtrack.ordonnances.exception.ApiException;
import com.healthtrack.ordonnances.model.*;
import com.healthtrack.ordonnances.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
public class OrdonnanceService {
    private static final Logger log = LoggerFactory.getLogger(OrdonnanceService.class);
    private final OrdonnanceRepository ordonnanceRepo;
    private final LignePrescriptionRepository ligneRepo;
    private final MedicamentRepository medicamentRepo;

    public OrdonnanceService(OrdonnanceRepository o, LignePrescriptionRepository l, MedicamentRepository m) {
        this.ordonnanceRepo = o; this.ligneRepo = l; this.medicamentRepo = m;
    }

    private Ordonnance checkExpiration(Ordonnance o) {
        if ("ACTIVE".equals(o.getStatut()) && o.getDateValidite() != null) {
            if (LocalDateTime.parse(o.getDateValidite()).isBefore(LocalDateTime.now(ZoneOffset.UTC))) {
                o.setStatut("EXPIREE"); o.setUpdatedAt(Instant.now().toString());
                o = ordonnanceRepo.save(o);
                log.info("Ordonnance {} passée EXPIREE", o.getOrdonnanceId());
            }
        }
        return o;
    }

    public Ordonnance createOrdonnance(String compteRenduId, String praticienId, String patientId) {
        if (ordonnanceRepo.existsByCompteRenduId(compteRenduId))
            throw new ApiException("ConsultationNotFinalizedException", "Une ordonnance existe déjà pour ce compte rendu", 409);
        String now = Instant.now().toString();
        Ordonnance o = new Ordonnance();
        o.setOrdonnanceId(UUID.randomUUID().toString());
        o.setCompteRenduId(compteRenduId); o.setPatientId(patientId); o.setPraticienId(praticienId);
        o.setDateEmission(now);
        o.setDateValidite(LocalDateTime.now(ZoneOffset.UTC).plusMonths(3).toString());
        o.setStatut("ACTIVE"); o.setCreatedAt(now); o.setUpdatedAt(now);
        return ordonnanceRepo.save(o);
    }

    public OrdonnanceAvecLignes getOrdonnance(String id, String userId) {
        Ordonnance o = ordonnanceRepo.findById(id).orElseThrow(() -> new ApiException("NotFound", "Ordonnance non trouvée", 404));
        o = checkExpiration(o);
        if (!o.getPatientId().equals(userId) && !o.getPraticienId().equals(userId))
            throw new ApiException("Forbidden", "Non autorisé", 403);
        return new OrdonnanceAvecLignes(o, ligneRepo.findByOrdonnanceId(id));
    }

    public PagedResponse<Ordonnance> listOrdonnances(String userId, String userType, String patientIdFilter, int page, int limit) {
        List<Ordonnance> all;
        if ("PATIENT".equals(userType)) all = ordonnanceRepo.findByPatient(userId);
        else if (patientIdFilter != null) all = ordonnanceRepo.findByPatient(patientIdFilter);
        else all = ordonnanceRepo.findByPraticien(userId);
        var items = all.stream().map(this::checkExpiration).toList();
        int from = Math.min((page-1)*limit, items.size());
        int to = Math.min(from+limit, items.size());
        return new PagedResponse<>(items.subList(from, to), items.size(), page, limit);
    }

    public LignePrescription addLigne(String ordonnanceId, LigneRequest req, String userId) {
        Ordonnance o = ordonnanceRepo.findById(ordonnanceId).orElseThrow(() -> new ApiException("NotFound", "Ordonnance non trouvée", 404));
        o = checkExpiration(o);
        if ("EXPIREE".equals(o.getStatut())) throw new ApiException("PrescriptionExpiredException", "L'ordonnance est expirée", 409);
        if (!o.getPraticienId().equals(userId)) throw new ApiException("Forbidden", "Seul le praticien peut ajouter des lignes", 403);
        if (!medicamentRepo.existsById(req.medicamentId())) throw new ApiException("NotFound", "Médicament non trouvé", 404);
        String now = Instant.now().toString();
        LignePrescription l = new LignePrescription();
        l.setLigneId(UUID.randomUUID().toString()); l.setOrdonnanceId(ordonnanceId);
        l.setMedicamentId(req.medicamentId()); l.setPosologie(req.posologie());
        l.setDuree(req.duree() != null ? req.duree() : 0); l.setInstructions(req.instructions() != null ? req.instructions() : "");
        l.setCreatedAt(now); l.setUpdatedAt(now);
        if (l.getDuree() != null && l.getDuree() > 90) log.info("Prescription durée > 90 jours: {}", ordonnanceId);
        return ligneRepo.save(l);
    }

    public void deleteLigne(String ordonnanceId, String ligneId, String userId) {
        Ordonnance o = ordonnanceRepo.findById(ordonnanceId).orElseThrow(() -> new ApiException("NotFound", "Ordonnance non trouvée", 404));
        if (!o.getPraticienId().equals(userId)) throw new ApiException("Forbidden", "Seul le praticien peut supprimer des lignes", 403);
        ligneRepo.deleteById(ordonnanceId, ligneId);
    }

    public List<LignePrescription> listLignes(String ordonnanceId, String userId) {
        Ordonnance o = ordonnanceRepo.findById(ordonnanceId).orElseThrow(() -> new ApiException("NotFound", "Ordonnance non trouvée", 404));
        if (!o.getPatientId().equals(userId) && !o.getPraticienId().equals(userId)) throw new ApiException("Forbidden", "Non autorisé", 403);
        return ligneRepo.findByOrdonnanceId(ordonnanceId);
    }

    public PagedResponse<Medicament> listMedicaments(String forme, int page, int limit) {
        List<Medicament> all = forme != null ? medicamentRepo.findByForme(forme) : medicamentRepo.findAll();
        int from = Math.min((page-1)*limit, all.size());
        int to = Math.min(from+limit, all.size());
        return new PagedResponse<>(all.subList(from, to), all.size(), page, limit);
    }

    public Medicament createMedicament(MedicamentRequest req) {
        if (medicamentRepo.existsByNom(req.nom())) throw new ApiException("Conflict", "Médicament déjà existant", 409);
        String now = Instant.now().toString();
        Medicament m = new Medicament();
        m.setMedicamentId(UUID.randomUUID().toString()); m.setNom(req.nom());
        m.setSubstanceActive(req.substanceActive() != null ? req.substanceActive() : "");
        m.setForme(req.forme()); m.setDescription(req.description() != null ? req.description() : "");
        m.setCreatedAt(now); m.setUpdatedAt(now);
        return medicamentRepo.save(m);
    }
}
