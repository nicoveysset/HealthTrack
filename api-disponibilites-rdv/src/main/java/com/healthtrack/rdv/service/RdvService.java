package com.healthtrack.rdv.service;

import com.healthtrack.rdv.dto.*;
import com.healthtrack.rdv.exception.ApiException;
import com.healthtrack.rdv.model.*;
import com.healthtrack.rdv.repository.*;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class RdvService {

    private static final int DUREE_DEFAULT = 30;
    private static final List<String> JOURS = List.of("LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI","DIMANCHE");
    private static final List<String> JOURS_COMPLET = List.of("DIMANCHE","LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI");

    private final DisponibiliteRepository dispoRepo;
    private final IndisponibiliteRepository indispoRepo;
    private final RendezVousRepository rdvRepo;
    private final CompteRenduRepository crRepo;
    private final PraticienRepository praticienRepo;

    public RdvService(DisponibiliteRepository dispoRepo, IndisponibiliteRepository indispoRepo,
                      RendezVousRepository rdvRepo, CompteRenduRepository crRepo,
                      PraticienRepository praticienRepo) {
        this.dispoRepo = dispoRepo; this.indispoRepo = indispoRepo;
        this.rdvRepo = rdvRepo; this.crRepo = crRepo; this.praticienRepo = praticienRepo;
    }

    // ========== Disponibilités ==========
    public List<Disponibilite> replaceDisponibilites(String praticienId, List<DisponibilitesRequest.DispoItem> dispos) {
        for (var d : dispos) validateDispo(d);
        validateNoOverlappingDisponibilites(dispos);
        dispoRepo.deleteByPraticienId(praticienId);
        List<Disponibilite> result = new ArrayList<>();
        String now = Instant.now().toString();
        for (var d : dispos) {
            Disponibilite dispo = new Disponibilite();
            dispo.setDispoId(UUID.randomUUID().toString());
            dispo.setPraticienId(praticienId);
            dispo.setJourSemaine(d.jourSemaine());
            dispo.setHeureDebut(d.heureDebut());
            dispo.setHeureFin(d.heureFin());
            dispo.setRecurrente(true);
            dispo.setCreatedAt(now); dispo.setUpdatedAt(now);
            result.add(dispoRepo.save(dispo));
        }
        return result;
    }

    private void validateNoOverlappingDisponibilites(List<DisponibilitesRequest.DispoItem> dispos) {
        for (int i = 0; i < dispos.size(); i++) {
            var current = dispos.get(i);
            int currentStart = toMinutes(current.heureDebut());
            int currentEnd = toMinutes(current.heureFin());
            for (int j = i + 1; j < dispos.size(); j++) {
                var other = dispos.get(j);
                if (!current.jourSemaine().equals(other.jourSemaine())) continue;
                int otherStart = toMinutes(other.heureDebut());
                int otherEnd = toMinutes(other.heureFin());
                if (currentStart < otherEnd && currentEnd > otherStart)
                    throw new ApiException("SlotOverlapException", "Les disponibilités du même jour ne peuvent pas se chevaucher", 409);
            }
        }
    }

    private void validateDispo(DisponibilitesRequest.DispoItem d) {
        if (!JOURS.contains(d.jourSemaine()))
            throw new ApiException("ValidationError", "jourSemaine invalide", 400);
        if (!d.heureDebut().matches("\\d{2}:\\d{2}") || !d.heureFin().matches("\\d{2}:\\d{2}"))
            throw new ApiException("ValidationError", "heures au format HH:MM requis", 400);
        int[] hd = parseHeure(d.heureDebut()), hf = parseHeure(d.heureFin());
        if (hd[0]*60+hd[1] >= hf[0]*60+hf[1])
            throw new ApiException("ValidationError", "heureFin doit être après heureDebut", 400);
    }

    public List<Disponibilite> getDisponibilites(String praticienId) {
        return dispoRepo.findByPraticienId(praticienId);
    }

    // ========== Indisponibilités ==========
    public Indisponibilite createIndisponibilite(String praticienId, IndisponibiliteRequest req) {
        LocalDateTime debut = LocalDateTime.parse(req.dateDebut());
        LocalDateTime fin = LocalDateTime.parse(req.dateFin());
        if (!fin.isAfter(debut))
            throw new ApiException("ValidationError", "dateFin doit être postérieure à dateDebut", 400);
        if (debut.isBefore(LocalDateTime.now()))
            throw new ApiException("PastDateException", "La date de début ne peut pas être dans le passé", 400);
        String now = Instant.now().toString();
        Indisponibilite i = new Indisponibilite();
        i.setIndispoId(UUID.randomUUID().toString());
        i.setPraticienId(praticienId);
        i.setDateDebut(req.dateDebut());
        i.setDateFin(req.dateFin());
        i.setMotif(req.motif() != null ? req.motif() : "");
        i.setRecurrente(false);
        i.setCreatedAt(now); i.setUpdatedAt(now);
        return indispoRepo.save(i);
    }

    public List<Indisponibilite> getIndisponibilites(String praticienId) {
        return indispoRepo.findByPraticienId(praticienId);
    }

    public void deleteIndisponibilite(String indispoId) {
        if (!indispoRepo.existsById(indispoId))
            throw new ApiException("NotFound", "Indisponibilité non trouvée", 404);
        indispoRepo.deleteById(indispoId);
    }

    // ========== Rendez-vous ==========
    public RendezVous createRendezVous(String patientId, RendezVousRequest req) {
        if (!req.date().matches("\\d{4}-\\d{2}-\\d{2}"))
            throw new ApiException("ValidationError", "date au format YYYY-MM-DD requis", 400);
        if (!req.heure().matches("\\d{2}:\\d{2}"))
            throw new ApiException("ValidationError", "heure au format HH:MM requis", 400);
        int duree = req.duree() != null ? req.duree() : DUREE_DEFAULT;
        LocalDateTime rdvDateTime = LocalDateTime.parse(req.date() + "T" + req.heure());
        if (rdvDateTime.isBefore(LocalDateTime.now()))
            throw new ApiException("PastDateException", "La date du rendez-vous est dans le passé", 400);
        requirePraticienActif(req.praticienId());
        if (!isDansDisponibilites(req.praticienId(), req.date(), req.heure(), duree)
            || overlapsIndisponibilite(req.praticienId(), req.date(), req.heure(), duree))
            throw new ApiException("PractitionerUnavailableException", "Le praticien n'est pas disponible à ce créneau", 409);
        if (overlapsRendezVous(req.praticienId(), req.date(), req.heure(), duree))
            throw new ApiException("SlotAlreadyTakenException", "Ce créneau n'est pas disponible", 409);

        String now = Instant.now().toString();
        RendezVous rdv = new RendezVous();
        rdv.setRdvId(UUID.randomUUID().toString());
        rdv.setPraticienId(req.praticienId());
        rdv.setPatientId(patientId);
        rdv.setDate(req.date());
        rdv.setHeure(req.heure());
        rdv.setDuree(duree);
        rdv.setStatut("PLANIFIE");
        rdv.setCreatedAt(now); rdv.setUpdatedAt(now);
        return rdvRepo.save(rdv);
    }

    public boolean isCreneauDisponible(String praticienId, String date, String heure, int duree) {
        return isDansDisponibilites(praticienId, date, heure, duree)
            && !overlapsIndisponibilite(praticienId, date, heure, duree)
            && !overlapsRendezVous(praticienId, date, heure, duree);
    }

    private void requirePraticienActif(String praticienId) {
        PraticienReference praticien = praticienRepo.findById(praticienId)
            .orElseThrow(() -> new ApiException("NotFound", "Praticien non trouvé", 404));
        if (!"PRATICIEN".equals(praticien.getType()))
            throw new ApiException("NotFound", "Praticien non trouvé", 404);
        if (!"ACTIF".equals(praticien.getStatut()))
            throw new ApiException("PractitionerUnavailableException", "Le praticien n'est pas disponible", 409);
    }

    private boolean isDansDisponibilites(String praticienId, String date, String heure, int duree) {
        String jourSemaine = JOURS_COMPLET.get(LocalDate.parse(date).getDayOfWeek().getValue() % 7);
        var dispos = dispoRepo.findByPraticienIdAndJour(praticienId, jourSemaine);
        int debutMin = toMinutes(heure);
        int finMin = debutMin + duree;
        for (var d : dispos) {
            int debutDispo = toMinutes(d.getHeureDebut());
            int finDispo = toMinutes(d.getHeureFin());
            if (debutMin >= debutDispo && finMin <= finDispo) return true;
        }
        return false;
    }

    private boolean overlapsIndisponibilite(String praticienId, String date, String heure, int duree) {
        LocalDateTime debut = LocalDateTime.parse(date + "T" + heure);
        LocalDateTime fin = debut.plusMinutes(duree);
        for (var indispo : indispoRepo.findByPraticienId(praticienId)) {
            LocalDateTime id = LocalDateTime.parse(indispo.getDateDebut());
            LocalDateTime ifin = LocalDateTime.parse(indispo.getDateFin());
            if (debut.isBefore(ifin) && fin.isAfter(id)) return true;
        }
        return false;
    }

    private boolean overlapsRendezVous(String praticienId, String date, String heure, int duree) {
        LocalDateTime debut = LocalDateTime.parse(date + "T" + heure);
        LocalDateTime fin = debut.plusMinutes(duree);
        for (var rdv : rdvRepo.findByPraticienIdAndDate(praticienId, date)) {
            if ("ANNULE".equals(rdv.getStatut()) || "NON_VENU".equals(rdv.getStatut())) continue;
            LocalDateTime rd = LocalDateTime.parse(rdv.getDate() + "T" + rdv.getHeure());
            LocalDateTime rf = rd.plusMinutes(rdv.getDuree() != null ? rdv.getDuree() : DUREE_DEFAULT);
            if (debut.isBefore(rf) && fin.isAfter(rd)) return true;
        }
        return false;
    }

    /**
     * Liste paginee des RDV de l'utilisateur connecte.
     * Filtres optionnels :
     *  - statut    : un ou plusieurs statuts separes par des virgules (ex. "PLANIFIE,CONFIRME")
     *  - dateDebut / dateFin : periode au format YYYY-MM-DD (bornes incluses)
     * Tri : par date puis heure croissantes.
     */
    public PagedResponse<RendezVous> listRendezVous(String userId, String type, String statut,
                                                    String dateDebut, String dateFin, int page, int limit) {
        if (page < 1 || limit < 1 || limit > 100)
            throw new ApiException("ValidationError", "page doit etre >= 1 et limit entre 1 et 100", 400);
        if (dateDebut != null && !dateDebut.matches("\\d{4}-\\d{2}-\\d{2}"))
            throw new ApiException("ValidationError", "dateDebut au format YYYY-MM-DD requis", 400);
        if (dateFin != null && !dateFin.matches("\\d{4}-\\d{2}-\\d{2}"))
            throw new ApiException("ValidationError", "dateFin au format YYYY-MM-DD requis", 400);

        List<RendezVous> rdvs = "PATIENT".equals(type) ? rdvRepo.findByPatient(userId) : rdvRepo.findByPraticien(userId);
        if (statut != null && !statut.isBlank()) {
            Set<String> statuts = new HashSet<>();
            for (String s : statut.split(",")) if (!s.isBlank()) statuts.add(s.trim().toUpperCase());
            rdvs = rdvs.stream().filter(r -> statuts.contains(r.getStatut())).toList();
        }
        // Les dates sont au format ISO (YYYY-MM-DD) : la comparaison de chaines suit l'ordre chronologique
        if (dateDebut != null) rdvs = rdvs.stream().filter(r -> r.getDate().compareTo(dateDebut) >= 0).toList();
        if (dateFin != null) rdvs = rdvs.stream().filter(r -> r.getDate().compareTo(dateFin) <= 0).toList();
        rdvs = rdvs.stream()
            .sorted(Comparator.comparing(RendezVous::getDate).thenComparing(RendezVous::getHeure))
            .toList();
        int from = Math.min((page-1)*limit, rdvs.size());
        int to = Math.min(from+limit, rdvs.size());
        return new PagedResponse<>(rdvs.subList(from, to), rdvs.size(), page, limit);
    }

    public RendezVous updateStatut(String rdvId, String newStatut, String userId, String userType) {
        RendezVous rdv = rdvRepo.findById(rdvId)
            .orElseThrow(() -> new ApiException("NotFound", "Rendez-vous non trouvé", 404));
        if (!rdv.getPatientId().equals(userId) && !rdv.getPraticienId().equals(userId))
            throw new ApiException("Forbidden", "Non autorisé à modifier ce rendez-vous", 403);

        Map<String, List<String>> transitions = Map.of(
            "PLANIFIE", List.of("CONFIRME", "ANNULE", "NON_VENU"),
            "CONFIRME", List.of("EN_COURS", "ANNULE", "NON_VENU"),
            "EN_COURS", List.of("TERMINE", "ANNULE"),
            "TERMINE", List.of(), "ANNULE", List.of(), "NON_VENU", List.of()
        );
        if (!transitions.getOrDefault(rdv.getStatut(), List.of()).contains(newStatut))
            throw new ApiException("InvalidStateException", "Transition " + rdv.getStatut() + " → " + newStatut + " impossible", 409);

        if ("ANNULE".equals(newStatut)) {
            LocalDateTime rdvTime = LocalDateTime.parse(rdv.getDate() + "T" + rdv.getHeure());
            if (Duration.between(LocalDateTime.now(), rdvTime).toHours() < 2)
                throw new ApiException("CancellationTooLateException", "Annulation impossible moins de 2h avant", 409);
        }
        if (("EN_COURS".equals(newStatut) || "TERMINE".equals(newStatut) || "NON_VENU".equals(newStatut))
            && (!"PRATICIEN".equals(userType) || !rdv.getPraticienId().equals(userId)))
            throw new ApiException("Forbidden", "Seul le praticien peut effectuer cette action", 403);

        rdv.setStatut(newStatut);
        rdv.setUpdatedAt(Instant.now().toString());
        return rdvRepo.save(rdv);
    }

    // ========== Créneaux ==========
    public List<Creneau> calculateCreneaux(String praticienId, String dateDebut, String dateFin) {
        List<Creneau> creneaux = new ArrayList<>();
        var dispos = dispoRepo.findByPraticienId(praticienId);
        var indispos = indispoRepo.findByPraticienId(praticienId);
        var rdvs = rdvRepo.findByPraticienIdAndDateBetween(praticienId, dateDebut, dateFin);
        LocalDate start = LocalDate.parse(dateDebut), end = LocalDate.parse(dateFin);
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            String dateStr = date.toString();
            String jour = JOURS_COMPLET.get(date.getDayOfWeek().getValue() % 7);
            var dispoJour = dispos.stream().filter(d -> d.getJourSemaine().equals(jour)).toList();
            for (var d : dispoJour) {
                int[] hd = parseHeure(d.getHeureDebut()), hf = parseHeure(d.getHeureFin());
                LocalDateTime cur = date.atTime(hd[0], hd[1]);
                LocalDateTime finDispo = date.atTime(hf[0], hf[1]);
                while (cur.isBefore(finDispo)) {
                    LocalDateTime finCreneau = cur.plusMinutes(DUREE_DEFAULT);
                    if (!isOccupe(cur, finCreneau, indispos, rdvs))
                        creneaux.add(new Creneau(dateStr, cur.format(DateTimeFormatter.ofPattern("HH:mm")), DUREE_DEFAULT));
                    cur = cur.plusMinutes(DUREE_DEFAULT);
                }
            }
        }
        return creneaux;
    }

    private boolean isOccupe(LocalDateTime debut, LocalDateTime fin, List<Indisponibilite> indispos, List<RendezVous> rdvs) {
        for (var i : indispos) {
            LocalDateTime id = LocalDateTime.parse(i.getDateDebut());
            LocalDateTime ifin = LocalDateTime.parse(i.getDateFin());
            if (debut.isBefore(ifin) && fin.isAfter(id)) return true;
        }
        for (var r : rdvs) {
            if ("ANNULE".equals(r.getStatut()) || "NON_VENU".equals(r.getStatut())) continue;
            LocalDateTime rd = LocalDateTime.parse(r.getDate() + "T" + r.getHeure());
            LocalDateTime rf = rd.plusMinutes(r.getDuree() != null ? r.getDuree() : DUREE_DEFAULT);
            if (debut.isBefore(rf) && fin.isAfter(rd)) return true;
        }
        return false;
    }

    // ========== Comptes rendus ==========
    public CompteRendu createCompteRendu(String rdvId, String contenu, String currentUserId) {
        if (contenu == null || contenu.length() < 10)
            throw new ApiException("ValidationError", "contenu doit contenir au moins 10 caractères", 400);
        RendezVous rdv = rdvRepo.findById(rdvId)
            .orElseThrow(() -> new ApiException("NotFound", "Rendez-vous non trouvé", 404));
        if (!"TERMINE".equals(rdv.getStatut()))
            throw new ApiException("ConsultationNotFinalizedException", "Le RDV doit être TERMINE", 409);
        if (!rdv.getPraticienId().equals(currentUserId))
            throw new ApiException("Forbidden", "Vous n'êtes pas le praticien de ce RDV", 403);
        if (crRepo.existsByRdvId(rdvId))
            throw new ApiException("Conflict", "Un compte rendu existe déjà pour ce RDV", 409);
        String now = Instant.now().toString();
        CompteRendu cr = new CompteRendu();
        cr.setCompteRenduId(UUID.randomUUID().toString());
        cr.setRdvId(rdvId);
        cr.setPraticienId(rdv.getPraticienId());
        cr.setPatientId(rdv.getPatientId());
        cr.setContenu(contenu);
        cr.setDateFinalisation(now);
        cr.setCreatedAt(now); cr.setUpdatedAt(now);
        return crRepo.save(cr);
    }

    public CompteRendu getCompteRenduByRdv(String rdvId, String currentUserId) {
        CompteRendu cr = crRepo.findByRdvId(rdvId)
            .orElseThrow(() -> new ApiException("NotFound", "Compte rendu non trouvé", 404));
        RendezVous rdv = rdvRepo.findById(rdvId)
            .orElseThrow(() -> new ApiException("NotFound", "Rendez-vous non trouvé", 404));
        if (!rdv.getPatientId().equals(currentUserId) && !rdv.getPraticienId().equals(currentUserId))
            throw new ApiException("Forbidden", "Non autorisé", 403);
        return cr;
    }

    private int[] parseHeure(String h) {
        String[] p = h.split(":");
        return new int[]{Integer.parseInt(p[0]), Integer.parseInt(p[1])};
    }

    private int toMinutes(String heure) {
        int[] parts = parseHeure(heure);
        return parts[0] * 60 + parts[1];
    }
}
