package com.healthtrack.ordonnances.service;

import com.healthtrack.ordonnances.dto.*;
import com.healthtrack.ordonnances.exception.*;
import com.healthtrack.ordonnances.model.*;
import com.healthtrack.ordonnances.monitoring.BusinessAlerts;
import com.healthtrack.ordonnances.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Règles métier des ordonnances.
 * <ul>
 *   <li>Création sur un rendez-vous non TERMINE (ou sans compte rendu finalisé) → {@link ConsultationNotFinalizedException}</li>
 *   <li>Création par un praticien n'ayant pas réalisé la consultation → {@link ForbiddenException}</li>
 *   <li>Médicament auquel le patient est allergique → {@link AllergyConflictException} + log/métrique CloudWatch</li>
 *   <li>Modification d'une ordonnance EXPIREE → {@link PrescriptionExpiredException}</li>
 *   <li>Ligne de plus de 90 jours → alerte métier CloudWatch (la ligne est acceptée)</li>
 * </ul>
 */
@Service
public class OrdonnanceService {

    private static final Logger log = LoggerFactory.getLogger(OrdonnanceService.class);
    static final int SEUIL_ALERTE_DUREE_JOURS = 90;
    static final int VALIDITE_MOIS = 3;
    private static final int MAX_LIMIT = 100;

    /** Identité de l'utilisateur connecté (extraite du JWT). */
    public record Caller(String userId, String type, String name) {
        boolean isPraticien() { return "PRATICIEN".equals(type); }
        boolean isPatient() { return "PATIENT".equals(type); }
    }

    private final OrdonnanceRepository ordonnanceRepo;
    private final LignePrescriptionRepository ligneRepo;
    private final MedicamentRepository medicamentRepo;
    private final CompteRenduRepository compteRenduRepo;
    private final RendezVousRepository rendezVousRepo;
    private final AllergieRepository allergieRepo;
    private final BusinessAlerts alerts;
    private final Clock clock;

    public OrdonnanceService(OrdonnanceRepository o, LignePrescriptionRepository l, MedicamentRepository m,
                             CompteRenduRepository compteRenduRepo, RendezVousRepository rendezVousRepo,
                             AllergieRepository allergieRepo, BusinessAlerts alerts, Clock clock) {
        this.ordonnanceRepo = o;
        this.ligneRepo = l;
        this.medicamentRepo = m;
        this.compteRenduRepo = compteRenduRepo;
        this.rendezVousRepo = rendezVousRepo;
        this.allergieRepo = allergieRepo;
        this.alerts = alerts;
        this.clock = clock;
    }

    // ========== Ordonnances ==========

    public Ordonnance createOrdonnance(String rdvId, Caller caller) {
        if (!caller.isPraticien())
            throw new ForbiddenException("Seul un praticien peut créer une ordonnance");
        var rdv = rendezVousRepo.findById(rdvId)
            .orElseThrow(() -> new NotFoundException("Rendez-vous " + rdvId + " non trouvé"));
        if (!caller.userId().equals(rdv.getPraticienId()))
            throw new ForbiddenException("Seul le praticien ayant réalisé la consultation peut créer l'ordonnance");
        if (!"TERMINE".equals(rdv.getStatut()))
            throw new ConsultationNotFinalizedException("Le rendez-vous doit être TERMINE pour émettre une ordonnance (statut actuel : "
                + rdv.getStatut() + ")");
        var cr = compteRenduRepo.findByRdvId(rdvId)
            .filter(c -> c.getDateFinalisation() != null && !c.getDateFinalisation().isBlank())
            .orElseThrow(() -> new ConsultationNotFinalizedException("Le compte rendu de la consultation doit être finalisé avant l'ordonnance"));
        if (ordonnanceRepo.findByRdvId(rdvId).isPresent())
            throw new ConflictException("Une ordonnance existe déjà pour ce rendez-vous");

        String now = Instant.now(clock).toString();
        Ordonnance o = new Ordonnance();
        o.setOrdonnanceId(UUID.randomUUID().toString());
        o.setCompteRenduId(cr.getCompteRenduId());
        o.setRdvId(rdvId);
        o.setPatientId(rdv.getPatientId());
        o.setPatientNom(rdv.getPatientNom());
        o.setPraticienId(caller.userId());
        o.setPraticienNom(caller.name());
        o.setDateEmission(now);
        o.setDateValidite(LocalDate.now(clock).plusMonths(VALIDITE_MOIS).atTime(23, 59, 59).toString());
        o.setStatut(OrdonnanceStatut.ACTIVE.name());
        o.setCreatedAt(now);
        o.setUpdatedAt(now);
        Ordonnance saved = ordonnanceRepo.save(o);
        log.info("{\"event\":\"ORDONNANCE_CREATED\",\"ordonnanceId\":\"{}\",\"rdvId\":\"{}\",\"praticienId\":\"{}\",\"patientId\":\"{}\"}",
            saved.getOrdonnanceId(), rdvId, caller.userId(), saved.getPatientId());
        return saved;
    }

    /** Passe l'ordonnance en EXPIREE si sa date de validité est dépassée. */
    private Ordonnance refreshStatut(Ordonnance o) {
        if (OrdonnanceStatut.ACTIVE.name().equals(o.getStatut()) && o.getDateValidite() != null
            && LocalDateTime.parse(o.getDateValidite()).isBefore(LocalDateTime.now(clock))) {
            o.setStatut(OrdonnanceStatut.EXPIREE.name());
            o.setUpdatedAt(Instant.now(clock).toString());
            o = ordonnanceRepo.save(o);
            log.info("{\"event\":\"ORDONNANCE_EXPIRED\",\"ordonnanceId\":\"{}\"}", o.getOrdonnanceId());
        }
        return o;
    }

    public OrdonnanceAvecLignes getOrdonnance(String id, Caller caller) {
        Ordonnance o = refreshStatut(findOrdonnance(id));
        requireReadAccess(o, caller);
        return new OrdonnanceAvecLignes(o, ligneRepo.findByOrdonnanceId(id));
    }

    /**
     * Liste paginée des ordonnances.
     * Patient : ses ordonnances. Praticien : celles qu'il a émises, ou toutes celles d'un patient (patientId)
     * s'il a déjà consulté ce patient. Filtres : statut, rdvId.
     */
    public PagedResponse<Ordonnance> listOrdonnances(Caller caller, String patientId, String rdvId, String statut, int page, int limit) {
        validatePagination(page, limit);
        String s = notBlank(statut) ? parseEnum(OrdonnanceStatut.class, statut, "statut").name() : null;

        List<Ordonnance> source;
        if (caller.isPatient()) {
            if (notBlank(patientId) && !patientId.equals(caller.userId()))
                throw new ForbiddenException("Un patient ne peut consulter que ses propres ordonnances");
            source = ordonnanceRepo.findByPatient(caller.userId());
        } else if (caller.isPraticien()) {
            if (notBlank(patientId)) {
                if (!rendezVousRepo.hasConsulted(patientId, caller.userId()))
                    throw new AccessDeniedException("Accès refusé : aucune consultation antérieure avec ce patient");
                source = ordonnanceRepo.findByPatient(patientId);
            } else {
                source = ordonnanceRepo.findByPraticien(caller.userId());
            }
        } else {
            throw new ForbiddenException("Type d'utilisateur inconnu");
        }

        List<Ordonnance> items = source.stream()
            .filter(o -> !notBlank(rdvId) || rdvId.equals(o.getRdvId()))
            .map(this::refreshStatut)
            .filter(o -> s == null || s.equals(o.getStatut()))
            .sorted(Comparator.comparing(Ordonnance::getDateEmission, Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();
        int from = Math.min((page - 1) * limit, items.size());
        int to = Math.min(from + limit, items.size());
        return new PagedResponse<>(items.subList(from, to), items.size(), page, limit);
    }

    // ========== Lignes de prescription ==========

    public LignePrescription addLigne(String ordonnanceId, LigneRequest req, Caller caller) {
        Ordonnance o = findModifiableOrdonnance(ordonnanceId, caller);
        Medicament medicament = medicamentRepo.findById(req.medicamentId())
            .orElseThrow(() -> new NotFoundException("Médicament " + req.medicamentId() + " non trouvé"));

        if (allergieRepo.conflictsWith(o.getPatientId(), medicament.getNom(), medicament.getSubstanceActive())) {
            alerts.allergyConflict(ordonnanceId, caller.userId(), o.getPatientId(), medicament.getNom(), medicament.getSubstanceActive());
            throw new AllergyConflictException("Le patient est allergique à " + medicament.getNom()
                + (notBlank(medicament.getSubstanceActive()) ? " (" + medicament.getSubstanceActive() + ")" : ""));
        }

        String now = Instant.now(clock).toString();
        LignePrescription l = new LignePrescription();
        l.setLigneId(UUID.randomUUID().toString());
        l.setOrdonnanceId(ordonnanceId);
        l.setMedicamentId(medicament.getMedicamentId());
        l.setMedicamentNom(medicament.getNom());
        l.setPosologie(req.posologie().trim());
        l.setDuree(req.duree());
        l.setInstructions(req.instructions() != null ? req.instructions().trim() : "");
        l.setCreatedAt(now);
        l.setUpdatedAt(now);
        LignePrescription saved = ligneRepo.save(l);

        if (req.duree() > SEUIL_ALERTE_DUREE_JOURS)
            alerts.longPrescription(ordonnanceId, saved.getLigneId(), caller.userId(), o.getPatientId(), medicament.getNom(), req.duree());

        touch(o);
        log.info("{\"event\":\"LIGNE_ADDED\",\"ordonnanceId\":\"{}\",\"ligneId\":\"{}\",\"medicamentId\":\"{}\",\"dureeJours\":{},\"praticienId\":\"{}\"}",
            ordonnanceId, saved.getLigneId(), medicament.getMedicamentId(), req.duree(), caller.userId());
        return saved;
    }

    public void deleteLigne(String ordonnanceId, String ligneId, Caller caller) {
        Ordonnance o = findModifiableOrdonnance(ordonnanceId, caller);
        if (ligneRepo.findById(ordonnanceId, ligneId).isEmpty())
            throw new NotFoundException("Ligne " + ligneId + " non trouvée dans cette ordonnance");
        ligneRepo.deleteById(ordonnanceId, ligneId);
        touch(o);
        log.info("{\"event\":\"LIGNE_REMOVED\",\"ordonnanceId\":\"{}\",\"ligneId\":\"{}\",\"praticienId\":\"{}\"}", ordonnanceId, ligneId, caller.userId());
    }

    public List<LignePrescription> listLignes(String ordonnanceId, Caller caller) {
        Ordonnance o = findOrdonnance(ordonnanceId);
        requireReadAccess(o, caller);
        return ligneRepo.findByOrdonnanceId(ordonnanceId);
    }

    /** Ordonnance modifiable : appartient au praticien appelant et n'est pas EXPIREE. */
    private Ordonnance findModifiableOrdonnance(String ordonnanceId, Caller caller) {
        Ordonnance o = refreshStatut(findOrdonnance(ordonnanceId));
        if (!caller.isPraticien() || !o.getPraticienId().equals(caller.userId()))
            throw new ForbiddenException("Seul le praticien auteur de l'ordonnance peut la modifier");
        if (OrdonnanceStatut.EXPIREE.name().equals(o.getStatut()))
            throw new PrescriptionExpiredException("L'ordonnance a expiré le " + o.getDateValidite().substring(0, 10)
                + " et ne peut plus être modifiée");
        return o;
    }

    private void touch(Ordonnance o) {
        o.setUpdatedAt(Instant.now(clock).toString());
        ordonnanceRepo.save(o);
    }

    // ========== Médicaments ==========

    public PagedResponse<Medicament> listMedicaments(String forme, String search, int page, int limit) {
        validatePagination(page, limit);
        String f = notBlank(forme) ? parseEnum(MedicamentForme.class, forme, "forme").name() : null;
        String q = notBlank(search) ? normalize(search) : null;
        List<Medicament> all = (f != null ? medicamentRepo.findByForme(f) : medicamentRepo.findAll()).stream()
            .filter(m -> q == null || normalize(m.getNom()).contains(q) || normalize(m.getSubstanceActive()).contains(q))
            .sorted(Comparator.comparing(Medicament::getNom, String.CASE_INSENSITIVE_ORDER))
            .toList();
        int from = Math.min((page - 1) * limit, all.size());
        int to = Math.min(from + limit, all.size());
        return new PagedResponse<>(all.subList(from, to), all.size(), page, limit);
    }

    public Medicament createMedicament(MedicamentRequest req, Caller caller) {
        if (!caller.isPraticien()) throw new ForbiddenException("Seul un praticien peut ajouter un médicament");
        String forme = parseEnum(MedicamentForme.class, req.forme(), "forme").name();
        if (medicamentRepo.existsByNom(req.nom().trim()))
            throw new ConflictException("Le médicament « " + req.nom().trim() + " » existe déjà");
        String now = Instant.now(clock).toString();
        Medicament m = new Medicament();
        m.setMedicamentId(UUID.randomUUID().toString());
        m.setNom(req.nom().trim());
        m.setSubstanceActive(req.substanceActive() != null ? req.substanceActive().trim() : "");
        m.setForme(forme);
        m.setDescription(req.description() != null ? req.description().trim() : "");
        m.setCreatedAt(now);
        m.setUpdatedAt(now);
        log.info("{\"event\":\"MEDICAMENT_CREATED\",\"medicamentId\":\"{}\",\"by\":\"{}\"}", m.getMedicamentId(), caller.userId());
        return medicamentRepo.save(m);
    }

    // ========== Utilitaires ==========

    private Ordonnance findOrdonnance(String id) {
        return ordonnanceRepo.findById(id).orElseThrow(() -> new NotFoundException("Ordonnance " + id + " non trouvée"));
    }

    /** Lecture : le patient concerné, le praticien auteur, ou un praticien ayant déjà consulté le patient. */
    private void requireReadAccess(Ordonnance o, Caller caller) {
        if (caller.userId().equals(o.getPatientId()) || caller.userId().equals(o.getPraticienId())) return;
        if (caller.isPraticien() && rendezVousRepo.hasConsulted(o.getPatientId(), caller.userId())) return;
        throw new ForbiddenException("Vous n'avez pas accès à cette ordonnance");
    }

    static void validatePagination(int page, int limit) {
        if (page < 1) throw new ValidationException("page doit être >= 1");
        if (limit < 1 || limit > MAX_LIMIT) throw new ValidationException("limit doit être compris entre 1 et " + MAX_LIMIT);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String normalize(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").trim().toLowerCase(Locale.ROOT);
    }

    static <E extends Enum<E>> E parseEnum(Class<E> type, String value, String field) {
        try {
            return Enum.valueOf(type, value.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException e) {
            throw new ValidationException(field + " invalide (valeurs possibles : " + Arrays.toString(type.getEnumConstants()) + ")");
        }
    }
}
