package com.healthtrack.rdv.service;

import com.healthtrack.rdv.dto.*;
import com.healthtrack.rdv.exception.*;
import com.healthtrack.rdv.model.*;
import com.healthtrack.rdv.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Règles métier Disponibilités / Rendez-vous.
 * <ul>
 *   <li>Créneau déjà occupé → {@link SlotAlreadyTakenException}</li>
 *   <li>Rendez-vous dans le passé → {@link PastDateException}</li>
 *   <li>Annulation moins de 2h avant → {@link CancellationTooLateException}</li>
 *   <li>Praticien EN_CONGE / INACTIF → {@link PractitionerNotAvailableException}</li>
 *   <li>Chevauchement de disponibilités → {@link SlotOverlapException}</li>
 *   <li>Rendez-vous pendant une indisponibilité ponctuelle → {@link PractitionerUnavailableException}</li>
 * </ul>
 * Toutes les heures sont exprimées dans le fuseau du cabinet (Europe/Paris, cf. TimeConfig).
 */
@Service
public class RdvService {

    private static final Logger log = LoggerFactory.getLogger(RdvService.class);

    static final int DUREE_DEFAULT = 30;
    private static final int DUREE_MIN = 10;
    private static final int DUREE_MAX = 180;
    private static final int MAX_PERIODE_JOURS = 62;
    private static final int MAX_LIMIT = 100;
    private static final long DELAI_ANNULATION_MINUTES = 120;
    private static final List<String> JOURS = List.of("LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE");
    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");
    private static final Set<String> STATUTS_LIBERANT_CRENEAU = Set.of("ANNULE", "NON_VENU");

    /** Transitions autorisées du cycle de vie d'un rendez-vous. */
    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
        "PLANIFIE", Set.of("CONFIRME", "ANNULE", "NON_VENU"),
        "CONFIRME", Set.of("EN_COURS", "ANNULE", "NON_VENU"),
        "EN_COURS", Set.of("TERMINE"),
        "TERMINE", Set.of(),
        "ANNULE", Set.of(),
        "NON_VENU", Set.of()
    );
    /** Statuts que seul le praticien du rendez-vous peut appliquer. */
    private static final Set<String> ACTIONS_PRATICIEN = Set.of("EN_COURS", "TERMINE", "NON_VENU");

    private final DisponibiliteRepository dispoRepo;
    private final IndisponibiliteRepository indispoRepo;
    private final RendezVousRepository rdvRepo;
    private final CompteRenduRepository crRepo;
    private final PraticienRepository userRepo;
    private final Clock clock;

    public RdvService(DisponibiliteRepository dispoRepo, IndisponibiliteRepository indispoRepo,
                      RendezVousRepository rdvRepo, CompteRenduRepository crRepo,
                      PraticienRepository userRepo, Clock clock) {
        this.dispoRepo = dispoRepo;
        this.indispoRepo = indispoRepo;
        this.rdvRepo = rdvRepo;
        this.crRepo = crRepo;
        this.userRepo = userRepo;
        this.clock = clock;
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    // =====================================================================
    // Disponibilités hebdomadaires
    // =====================================================================

    /** Définit (ou redéfinit entièrement) les disponibilités hebdomadaires du praticien. */
    public List<Disponibilite> replaceDisponibilites(String praticienId, List<DisponibilitesRequest.DispoItem> dispos) {
        if (dispos == null) throw new ValidationException("disponibilites est requis (liste, éventuellement vide)");
        for (var d : dispos) validateDispo(d);
        validateNoOverlappingDisponibilites(dispos);

        dispoRepo.deleteByPraticienId(praticienId);
        String now = Instant.now(clock).toString();
        List<Disponibilite> result = new ArrayList<>();
        for (var d : dispos) {
            Disponibilite dispo = new Disponibilite();
            dispo.setDispoId(UUID.randomUUID().toString());
            dispo.setPraticienId(praticienId);
            dispo.setJourSemaine(d.jourSemaine().trim().toUpperCase(Locale.ROOT));
            dispo.setHeureDebut(d.heureDebut());
            dispo.setHeureFin(d.heureFin());
            dispo.setRecurrente(true);
            dispo.setCreatedAt(now);
            dispo.setUpdatedAt(now);
            result.add(dispoRepo.save(dispo));
        }
        log.info("{\"event\":\"DISPONIBILITES_UPDATED\",\"praticienId\":\"{}\",\"count\":{}}", praticienId, result.size());
        return sortDispos(result);
    }

    private void validateDispo(DisponibilitesRequest.DispoItem d) {
        if (d == null || d.jourSemaine() == null || d.heureDebut() == null || d.heureFin() == null)
            throw new ValidationException("Chaque disponibilité doit avoir jourSemaine, heureDebut et heureFin");
        if (!JOURS.contains(d.jourSemaine().trim().toUpperCase(Locale.ROOT)))
            throw new ValidationException("jourSemaine invalide (valeurs possibles : " + JOURS + ")");
        int debut = toMinutes(d.heureDebut(), "heureDebut");
        int fin = toMinutes(d.heureFin(), "heureFin");
        if (debut >= fin) throw new ValidationException("heureFin doit être après heureDebut (" + d.jourSemaine() + ")");
    }

    private void validateNoOverlappingDisponibilites(List<DisponibilitesRequest.DispoItem> dispos) {
        for (int i = 0; i < dispos.size(); i++) {
            var a = dispos.get(i);
            for (int j = i + 1; j < dispos.size(); j++) {
                var b = dispos.get(j);
                if (!a.jourSemaine().equalsIgnoreCase(b.jourSemaine())) continue;
                if (toMinutes(a.heureDebut(), "heureDebut") < toMinutes(b.heureFin(), "heureFin")
                    && toMinutes(a.heureFin(), "heureFin") > toMinutes(b.heureDebut(), "heureDebut"))
                    throw new SlotOverlapException("Les créneaux " + a.heureDebut() + "-" + a.heureFin() + " et "
                        + b.heureDebut() + "-" + b.heureFin() + " du " + a.jourSemaine() + " se chevauchent");
            }
        }
    }

    public List<Disponibilite> getDisponibilites(String praticienId) {
        return sortDispos(dispoRepo.findByPraticienId(praticienId));
    }

    private List<Disponibilite> sortDispos(List<Disponibilite> list) {
        return list.stream()
            .sorted(Comparator.comparing((Disponibilite d) -> JOURS.indexOf(d.getJourSemaine()))
                .thenComparing(Disponibilite::getHeureDebut))
            .toList();
    }

    // =====================================================================
    // Indisponibilités ponctuelles
    // =====================================================================

    public Indisponibilite createIndisponibilite(String praticienId, IndisponibiliteRequest req) {
        LocalDateTime debut = parseDateTime(req.dateDebut(), "dateDebut", false);
        LocalDateTime fin = parseDateTime(req.dateFin(), "dateFin", true);
        if (!fin.isAfter(debut)) throw new ValidationException("dateFin doit être postérieure à dateDebut");
        if (fin.isBefore(now())) throw new PastDateException("L'indisponibilité se termine dans le passé");

        String now = Instant.now(clock).toString();
        Indisponibilite i = new Indisponibilite();
        i.setIndispoId(UUID.randomUUID().toString());
        i.setPraticienId(praticienId);
        i.setDateDebut(debut.toString());
        i.setDateFin(fin.toString());
        i.setMotif(req.motif() != null ? req.motif().trim() : "");
        i.setRecurrente(false);
        i.setCreatedAt(now);
        i.setUpdatedAt(now);
        Indisponibilite saved = indispoRepo.save(i);

        long rdvImpactes = rdvRepo.findByPraticien(praticienId).stream()
            .filter(r -> !STATUTS_LIBERANT_CRENEAU.contains(r.getStatut()) && !"TERMINE".equals(r.getStatut()))
            .filter(r -> overlaps(rdvStart(r), rdvEnd(r), debut, fin))
            .count();
        log.info("{\"event\":\"INDISPONIBILITE_CREATED\",\"praticienId\":\"{}\",\"indispoId\":\"{}\",\"rdvExistantsSurLaPeriode\":{}}",
            praticienId, saved.getIndispoId(), rdvImpactes);
        return saved;
    }

    public List<Indisponibilite> getIndisponibilites(String praticienId) {
        return indispoRepo.findByPraticienId(praticienId).stream()
            .sorted(Comparator.comparing(Indisponibilite::getDateDebut))
            .toList();
    }

    public void deleteIndisponibilite(String indispoId, String praticienId) {
        Indisponibilite i = indispoRepo.findById(indispoId)
            .orElseThrow(() -> new NotFoundException("Indisponibilité " + indispoId + " non trouvée"));
        if (!praticienId.equals(i.getPraticienId()))
            throw new ForbiddenException("Cette indisponibilité appartient à un autre praticien");
        indispoRepo.deleteById(indispoId);
        log.info("{\"event\":\"INDISPONIBILITE_DELETED\",\"praticienId\":\"{}\",\"indispoId\":\"{}\"}", praticienId, indispoId);
    }

    // =====================================================================
    // Rendez-vous
    // =====================================================================

    /**
     * Prise de rendez-vous. Un patient réserve pour lui-même ; un praticien peut réserver
     * dans son propre agenda pour un patient (champ patientId).
     */
    public RendezVous createRendezVous(String userId, String userType, String userName, RendezVousRequest req) {
        String patientId;
        String patientNom;
        if ("PRATICIEN".equals(userType)) {
            if (!userId.equals(req.praticienId()))
                throw new ForbiddenException("Un praticien ne peut créer des rendez-vous que dans son propre agenda");
            if (req.patientId() == null || req.patientId().isBlank())
                throw new ValidationException("patientId est requis quand un praticien crée le rendez-vous");
            PraticienReference patient = userRepo.findById(req.patientId())
                .filter(u -> "PATIENT".equals(u.getType()))
                .orElseThrow(() -> new NotFoundException("Patient " + req.patientId() + " non trouvé"));
            patientId = patient.getUserId();
            patientNom = patient.getName();
        } else if ("PATIENT".equals(userType)) {
            patientId = userId;
            patientNom = userName;
        } else {
            throw new ForbiddenException("Type d'utilisateur inconnu");
        }

        LocalDate date = parseDate(req.date(), "date");
        int debutMin = toMinutes(req.heure(), "heure");
        int duree = req.duree() != null ? req.duree() : DUREE_DEFAULT;
        if (duree < DUREE_MIN || duree > DUREE_MAX)
            throw new ValidationException("duree doit être comprise entre " + DUREE_MIN + " et " + DUREE_MAX + " minutes");
        LocalDateTime debut = date.atStartOfDay().plusMinutes(debutMin);
        LocalDateTime fin = debut.plusMinutes(duree);

        if (!debut.isAfter(now()))
            throw new PastDateException("Le rendez-vous du " + req.date() + " à " + req.heure() + " est dans le passé");

        PraticienReference praticien = requirePraticienActif(req.praticienId());

        if (overlapsIndisponibilite(req.praticienId(), debut, fin))
            throw new PractitionerUnavailableException("Le praticien a déclaré une indisponibilité sur ce créneau");
        if (!isDansDisponibilites(req.praticienId(), date, debutMin, duree))
            throw new OutsideAvailabilityException("Le créneau " + req.heure() + " (" + duree + " min) est en dehors des disponibilités du praticien");
        if (overlapsRendezVous(req.praticienId(), date.toString(), debut, fin, null))
            throw new SlotAlreadyTakenException("Le créneau du " + req.date() + " à " + req.heure() + " est déjà occupé");

        String now = Instant.now(clock).toString();
        RendezVous rdv = new RendezVous();
        rdv.setRdvId(UUID.randomUUID().toString());
        rdv.setPraticienId(req.praticienId());
        rdv.setPraticienNom(praticien.getName());
        rdv.setPatientId(patientId);
        rdv.setPatientNom(patientNom);
        rdv.setDate(date.toString());
        rdv.setHeure(debut.toLocalTime().format(HHMM));
        rdv.setDuree(duree);
        rdv.setMotif(req.motif() != null ? req.motif().trim() : "");
        rdv.setStatut("PLANIFIE");
        rdv.setCreatedAt(now);
        rdv.setUpdatedAt(now);
        RendezVous saved = rdvRepo.save(rdv);
        log.info("{\"event\":\"RDV_CREATED\",\"rdvId\":\"{}\",\"praticienId\":\"{}\",\"patientId\":\"{}\",\"date\":\"{}\",\"heure\":\"{}\",\"createdBy\":\"{}\"}",
            saved.getRdvId(), saved.getPraticienId(), patientId, saved.getDate(), saved.getHeure(), userId);
        return saved;
    }

    private PraticienReference requirePraticienActif(String praticienId) {
        PraticienReference praticien = userRepo.findById(praticienId)
            .filter(u -> "PRATICIEN".equals(u.getType()))
            .orElseThrow(() -> new NotFoundException("Praticien " + praticienId + " non trouvé"));
        if (!"ACTIF".equals(praticien.getStatut()))
            throw new PractitionerNotAvailableException("Le praticien est " + praticien.getStatut()
                + " et ne peut pas recevoir de rendez-vous");
        return praticien;
    }

    private boolean isDansDisponibilites(String praticienId, LocalDate date, int debutMin, int duree) {
        String jour = JOURS.get(date.getDayOfWeek().getValue() - 1);
        for (var d : dispoRepo.findByPraticienIdAndJour(praticienId, jour)) {
            if (debutMin >= toMinutes(d.getHeureDebut(), "heureDebut") && debutMin + duree <= toMinutes(d.getHeureFin(), "heureFin"))
                return true;
        }
        return false;
    }

    private boolean overlapsIndisponibilite(String praticienId, LocalDateTime debut, LocalDateTime fin) {
        return indispoRepo.findByPraticienId(praticienId).stream()
            .anyMatch(i -> overlaps(debut, fin, LocalDateTime.parse(i.getDateDebut()), LocalDateTime.parse(i.getDateFin())));
    }

    private boolean overlapsRendezVous(String praticienId, String date, LocalDateTime debut, LocalDateTime fin, String excludeRdvId) {
        return rdvRepo.findByPraticienIdAndDate(praticienId, date).stream()
            .filter(r -> !STATUTS_LIBERANT_CRENEAU.contains(r.getStatut()))
            .filter(r -> excludeRdvId == null || !excludeRdvId.equals(r.getRdvId()))
            .anyMatch(r -> overlaps(debut, fin, rdvStart(r), rdvEnd(r)));
    }

    public RendezVous getRendezVous(String rdvId, String userId) {
        RendezVous rdv = findRdv(rdvId);
        requireParticipant(rdv, userId);
        return rdv;
    }

    /**
     * Liste paginée des rendez-vous de l'utilisateur connecté (patient ou praticien).
     * Filtres : statut (un ou plusieurs, séparés par des virgules), dateDebut / dateFin (YYYY-MM-DD, inclus).
     */
    public PagedResponse<RendezVous> listRendezVous(String userId, String type, String statut,
                                                    String dateDebut, String dateFin, int page, int limit) {
        validatePagination(page, limit);
        String debut = dateDebut != null && !dateDebut.isBlank() ? parseDate(dateDebut, "dateDebut").toString() : null;
        String fin = dateFin != null && !dateFin.isBlank() ? parseDate(dateFin, "dateFin").toString() : null;
        if (debut != null && fin != null && fin.compareTo(debut) < 0)
            throw new ValidationException("dateFin doit être postérieure ou égale à dateDebut");

        Set<String> statuts = new HashSet<>();
        if (statut != null && !statut.isBlank()) {
            for (String s : statut.split(",")) {
                if (s.isBlank()) continue;
                String up = s.trim().toUpperCase(Locale.ROOT);
                if (!TRANSITIONS.containsKey(up))
                    throw new ValidationException("statut invalide : " + s.trim() + " (valeurs possibles : " + TRANSITIONS.keySet() + ")");
                statuts.add(up);
            }
        }

        List<RendezVous> rdvs = ("PATIENT".equals(type) ? rdvRepo.findByPatient(userId) : rdvRepo.findByPraticien(userId))
            .stream()
            .filter(r -> statuts.isEmpty() || statuts.contains(r.getStatut()))
            // dates ISO (YYYY-MM-DD) : l'ordre lexicographique est l'ordre chronologique
            .filter(r -> debut == null || r.getDate().compareTo(debut) >= 0)
            .filter(r -> fin == null || r.getDate().compareTo(fin) <= 0)
            .sorted(Comparator.comparing(RendezVous::getDate).thenComparing(RendezVous::getHeure))
            .toList();
        int from = Math.min((page - 1) * limit, rdvs.size());
        int to = Math.min(from + limit, rdvs.size());
        return new PagedResponse<>(rdvs.subList(from, to), rdvs.size(), page, limit);
    }

    /** Fait évoluer le statut d'un rendez-vous en respectant le cycle de vie et les droits de chacun. */
    public RendezVous updateStatut(String rdvId, String statutDemande, String userId, String userType) {
        RendezVous rdv = findRdv(rdvId);
        requireParticipant(rdv, userId);
        String nouveau = statutDemande.trim().toUpperCase(Locale.ROOT);
        if (!TRANSITIONS.containsKey(nouveau) || "PLANIFIE".equals(nouveau))
            throw new ValidationException("statut invalide : " + statutDemande + " (CONFIRME, EN_COURS, TERMINE, ANNULE, NON_VENU)");

        boolean estPraticien = "PRATICIEN".equals(userType) && rdv.getPraticienId().equals(userId);
        if (ACTIONS_PRATICIEN.contains(nouveau) && !estPraticien)
            throw new ForbiddenException("Seul le praticien du rendez-vous peut le passer en " + nouveau);

        if (!TRANSITIONS.getOrDefault(rdv.getStatut(), Set.of()).contains(nouveau))
            throw new InvalidStatusTransitionException("Transition " + rdv.getStatut() + " → " + nouveau + " impossible");

        LocalDateTime debutRdv = rdvStart(rdv);
        if ("ANNULE".equals(nouveau)) {
            long minutesAvant = ChronoUnit.MINUTES.between(now(), debutRdv);
            if (minutesAvant < DELAI_ANNULATION_MINUTES)
                throw new CancellationTooLateException("Annulation impossible moins de 2h avant le rendez-vous (il reste "
                    + Math.max(minutesAvant, 0) + " min)");
        }
        if ("NON_VENU".equals(nouveau) && now().isBefore(debutRdv))
            throw new InvalidStatusTransitionException("Impossible de déclarer le patient absent avant l'heure du rendez-vous");

        String ancien = rdv.getStatut();
        rdv.setStatut(nouveau);
        rdv.setUpdatedAt(Instant.now(clock).toString());
        RendezVous saved = rdvRepo.save(rdv);
        log.info("{\"event\":\"RDV_STATUT_CHANGED\",\"rdvId\":\"{}\",\"from\":\"{}\",\"to\":\"{}\",\"by\":\"{}\",\"byType\":\"{}\"}",
            rdvId, ancien, nouveau, userId, userType);
        return saved;
    }

    // =====================================================================
    // Créneaux disponibles
    // =====================================================================

    /** Créneaux libres de 30 min d'un praticien sur une période (passés, indisponibilités et RDV exclus). */
    public List<Creneau> calculateCreneaux(String praticienId, String dateDebut, String dateFin) {
        LocalDate start = parseDate(dateDebut, "dateDebut");
        LocalDate end = parseDate(dateFin, "dateFin");
        if (end.isBefore(start)) throw new ValidationException("dateFin doit être postérieure ou égale à dateDebut");
        if (ChronoUnit.DAYS.between(start, end) > MAX_PERIODE_JOURS)
            throw new ValidationException("La période ne peut pas dépasser " + MAX_PERIODE_JOURS + " jours");
        requirePraticienActif(praticienId);

        var dispos = dispoRepo.findByPraticienId(praticienId);
        var indispos = indispoRepo.findByPraticienId(praticienId);
        var rdvs = rdvRepo.findByPraticienIdAndDateBetween(praticienId, start.toString(), end.toString()).stream()
            .filter(r -> !STATUTS_LIBERANT_CRENEAU.contains(r.getStatut()))
            .toList();
        LocalDateTime maintenant = now();

        List<Creneau> creneaux = new ArrayList<>();
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            String jour = JOURS.get(date.getDayOfWeek().getValue() - 1);
            var dispoJour = dispos.stream().filter(d -> d.getJourSemaine().equals(jour))
                .sorted(Comparator.comparing(Disponibilite::getHeureDebut)).toList();
            for (var d : dispoJour) {
                LocalDateTime cur = date.atStartOfDay().plusMinutes(toMinutes(d.getHeureDebut(), "heureDebut"));
                LocalDateTime finDispo = date.atStartOfDay().plusMinutes(toMinutes(d.getHeureFin(), "heureFin"));
                while (!cur.plusMinutes(DUREE_DEFAULT).isAfter(finDispo)) {
                    LocalDateTime finCreneau = cur.plusMinutes(DUREE_DEFAULT);
                    final LocalDateTime c = cur;
                    boolean libre = c.isAfter(maintenant)
                        && indispos.stream().noneMatch(i -> overlaps(c, finCreneau, LocalDateTime.parse(i.getDateDebut()), LocalDateTime.parse(i.getDateFin())))
                        && rdvs.stream().noneMatch(r -> overlaps(c, finCreneau, rdvStart(r), rdvEnd(r)));
                    if (libre) creneaux.add(new Creneau(date.toString(), cur.toLocalTime().format(HHMM), DUREE_DEFAULT));
                    cur = finCreneau;
                }
            }
        }
        return creneaux;
    }

    // =====================================================================
    // Comptes rendus
    // =====================================================================

    /** Rédaction du compte rendu (BROUILLON, ou FINALISE si finaliser=true). Le RDV doit être TERMINE. */
    public CompteRendu createCompteRendu(String rdvId, CompteRenduRequest req, String praticienId) {
        RendezVous rdv = findRdv(rdvId);
        if (!rdv.getPraticienId().equals(praticienId))
            throw new ForbiddenException("Vous n'êtes pas le praticien de ce rendez-vous");
        if (!"TERMINE".equals(rdv.getStatut()))
            throw new ConsultationNotFinalizedException("Le rendez-vous doit être TERMINE pour rédiger le compte rendu (statut actuel : "
                + rdv.getStatut() + ")");
        if (crRepo.existsByRdvId(rdvId))
            throw new ConflictException("Un compte rendu existe déjà pour ce rendez-vous (utilisez PUT pour le modifier)");

        String now = Instant.now(clock).toString();
        CompteRendu cr = new CompteRendu();
        cr.setCompteRenduId(UUID.randomUUID().toString());
        cr.setRdvId(rdvId);
        cr.setPraticienId(rdv.getPraticienId());
        cr.setPatientId(rdv.getPatientId());
        cr.setContenu(req.contenu().trim());
        cr.setDiagnostic(req.diagnostic() != null ? req.diagnostic().trim() : "");
        cr.setStatut(CompteRenduStatut.BROUILLON.name());
        cr.setCreatedAt(now);
        cr.setUpdatedAt(now);
        if (Boolean.TRUE.equals(req.finaliser())) {
            cr.setStatut(CompteRenduStatut.FINALISE.name());
            cr.setDateFinalisation(now);
        }
        CompteRendu saved = crRepo.save(cr);
        log.info("{\"event\":\"COMPTE_RENDU_CREATED\",\"compteRenduId\":\"{}\",\"rdvId\":\"{}\",\"praticienId\":\"{}\",\"statut\":\"{}\"}",
            saved.getCompteRenduId(), rdvId, praticienId, saved.getStatut());
        return saved;
    }

    /** Modification d'un compte rendu encore en BROUILLON. */
    public CompteRendu updateCompteRendu(String rdvId, CompteRenduRequest req, String praticienId) {
        CompteRendu cr = findOwnCompteRendu(rdvId, praticienId);
        if (isFinalise(cr))
            throw new CompteRenduAlreadyFinalizedException("Le compte rendu est finalisé et ne peut plus être modifié");
        cr.setContenu(req.contenu().trim());
        if (req.diagnostic() != null) cr.setDiagnostic(req.diagnostic().trim());
        String now = Instant.now(clock).toString();
        cr.setUpdatedAt(now);
        if (Boolean.TRUE.equals(req.finaliser())) {
            cr.setStatut(CompteRenduStatut.FINALISE.name());
            cr.setDateFinalisation(now);
        }
        log.info("{\"event\":\"COMPTE_RENDU_UPDATED\",\"compteRenduId\":\"{}\",\"praticienId\":\"{}\",\"statut\":\"{}\"}",
            cr.getCompteRenduId(), praticienId, cr.getStatut());
        return crRepo.save(cr);
    }

    /** Finalisation : le compte rendu devient définitif et une ordonnance peut être émise. */
    public CompteRendu finaliserCompteRendu(String rdvId, String praticienId) {
        CompteRendu cr = findOwnCompteRendu(rdvId, praticienId);
        if (isFinalise(cr)) throw new CompteRenduAlreadyFinalizedException();
        String now = Instant.now(clock).toString();
        cr.setStatut(CompteRenduStatut.FINALISE.name());
        cr.setDateFinalisation(now);
        cr.setUpdatedAt(now);
        log.info("{\"event\":\"COMPTE_RENDU_FINALIZED\",\"compteRenduId\":\"{}\",\"praticienId\":\"{}\"}", cr.getCompteRenduId(), praticienId);
        return crRepo.save(cr);
    }

    public CompteRendu getCompteRenduByRdv(String rdvId, String userId) {
        RendezVous rdv = findRdv(rdvId);
        requireParticipant(rdv, userId);
        CompteRendu cr = crRepo.findByRdvId(rdvId)
            .orElseThrow(() -> new NotFoundException("Aucun compte rendu pour ce rendez-vous"));
        // Le patient ne voit le compte rendu qu'une fois finalisé (pas les brouillons du praticien).
        if (rdv.getPatientId().equals(userId) && !isFinalise(cr))
            throw new NotFoundException("Le compte rendu n'est pas encore finalisé");
        return cr;
    }

    private CompteRendu findOwnCompteRendu(String rdvId, String praticienId) {
        RendezVous rdv = findRdv(rdvId);
        if (!rdv.getPraticienId().equals(praticienId))
            throw new ForbiddenException("Vous n'êtes pas le praticien de ce rendez-vous");
        return crRepo.findByRdvId(rdvId).orElseThrow(() -> new NotFoundException("Aucun compte rendu pour ce rendez-vous"));
    }

    private static boolean isFinalise(CompteRendu cr) {
        // Les anciens comptes rendus (sans statut) étaient finalisés dès leur création.
        return CompteRenduStatut.FINALISE.name().equals(cr.getStatut())
            || (cr.getStatut() == null && cr.getDateFinalisation() != null);
    }

    // =====================================================================
    // Utilitaires
    // =====================================================================

    private RendezVous findRdv(String rdvId) {
        return rdvRepo.findById(rdvId).orElseThrow(() -> new NotFoundException("Rendez-vous " + rdvId + " non trouvé"));
    }

    private static void requireParticipant(RendezVous rdv, String userId) {
        if (!rdv.getPatientId().equals(userId) && !rdv.getPraticienId().equals(userId))
            throw new ForbiddenException("Vous ne participez pas à ce rendez-vous");
    }

    private static LocalDateTime rdvStart(RendezVous r) {
        return LocalDateTime.parse(r.getDate() + "T" + r.getHeure());
    }

    private static LocalDateTime rdvEnd(RendezVous r) {
        return rdvStart(r).plusMinutes(r.getDuree() != null ? r.getDuree() : DUREE_DEFAULT);
    }

    private static boolean overlaps(LocalDateTime d1, LocalDateTime f1, LocalDateTime d2, LocalDateTime f2) {
        return d1.isBefore(f2) && f1.isAfter(d2);
    }

    static void validatePagination(int page, int limit) {
        if (page < 1) throw new ValidationException("page doit être >= 1");
        if (limit < 1 || limit > MAX_LIMIT) throw new ValidationException("limit doit être compris entre 1 et " + MAX_LIMIT);
    }

    static LocalDate parseDate(String value, String field) {
        try {
            return LocalDate.parse(value.trim());
        } catch (RuntimeException e) {
            throw new ValidationException(field + " doit être une date valide au format YYYY-MM-DD");
        }
    }

    static int toMinutes(String heure, String field) {
        if (heure == null || !heure.trim().matches("\\d{2}:\\d{2}"))
            throw new ValidationException(field + " doit être au format HH:MM");
        String[] p = heure.trim().split(":");
        int h = Integer.parseInt(p[0]), m = Integer.parseInt(p[1]);
        if (h > 23 || m > 59) throw new ValidationException(field + " invalide : " + heure);
        return h * 60 + m;
    }

    /**
     * Accepte "YYYY-MM-DD" (début ou fin de journée), "YYYY-MM-DDTHH:MM[:SS]" (heure du cabinet)
     * ou une date ISO avec fuseau ("...Z", "+01:00"), convertie dans le fuseau du cabinet.
     */
    LocalDateTime parseDateTime(String value, String field, boolean finDeJournee) {
        if (value == null || value.isBlank()) throw new ValidationException(field + " est requis");
        String v = value.trim();
        try {
            if (v.length() == 10) {
                LocalDate d = LocalDate.parse(v);
                return finDeJournee ? d.atTime(23, 59) : d.atStartOfDay();
            }
            if (v.endsWith("Z") || v.matches(".*[+-]\\d{2}:\\d{2}$"))
                return OffsetDateTime.parse(v).atZoneSameInstant(clock.getZone()).toLocalDateTime().truncatedTo(ChronoUnit.MINUTES);
            return LocalDateTime.parse(v).truncatedTo(ChronoUnit.MINUTES);
        } catch (DateTimeParseException e) {
            throw new ValidationException(field + " invalide : attendu YYYY-MM-DD ou YYYY-MM-DDTHH:MM");
        }
    }
}
