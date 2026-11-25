package com.healthtrack.rdv.service;

import com.healthtrack.rdv.dto.*;
import com.healthtrack.rdv.exception.ApiException;
import com.healthtrack.rdv.model.*;
import com.healthtrack.rdv.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@Transactional
public class RdvService {

    private static final int DUREE_DEFAULT = 30;
    private static final List<String> JOURS = List.of("LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI","DIMANCHE");
    private static final List<String> JOURS_COMPLET = List.of("DIMANCHE","LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI");

    private final DisponibiliteRepository dispoRepo;
    private final IndisponibiliteRepository indispoRepo;
    private final RendezVousRepository rdvRepo;
    private final CompteRenduRepository crRepo;

    public RdvService(DisponibiliteRepository dispoRepo, IndisponibiliteRepository indispoRepo,
                      RendezVousRepository rdvRepo, CompteRenduRepository crRepo) {
        this.dispoRepo = dispoRepo; this.indispoRepo = indispoRepo;
        this.rdvRepo = rdvRepo; this.crRepo = crRepo;
    }

    // ========== Disponibilités ==========
    public List<Disponibilite> replaceDisponibilites(String praticienId, List<DisponibilitesRequest.DispoItem> dispos) {
        for (var d : dispos) validateDispo(praticienId, d);
        dispoRepo.deleteByPraticienId(praticienId);
        List<Disponibilite> result = new ArrayList<>();
        for (var d : dispos) {
            Disponibilite dispo = new Disponibilite();
            dispo.setDispoId(UUID.randomUUID().toString());
            dispo.setPraticienId(praticienId);
            dispo.setJourSemaine(d.jourSemaine());
            dispo.setHeureDebut(d.heureDebut());
            dispo.setHeureFin(d.heureFin());
            dispo.setRecurrente(true);
            result.add(dispoRepo.save(dispo));
        }
        return result;
    }

    private void validateDispo(String praticienId, DisponibilitesRequest.DispoItem d) {
        if (!JOURS.contains(d.jourSemaine()))
            throw new ApiException("ValidationError", "jourSemaine invalide", 400);
        if (!d.heureDebut().matches("\\d{2}:\\d{2}") || !d.heureFin().matches("\\d{2}:\\d{2}"))
            throw new ApiException("ValidationError", "heures au format HH:MM requis", 400);
        int[] hd = parseHeure(d.heureDebut()), hf = parseHeure(d.heureFin());
        if (hd[0]*60+hd[1] >= hf[0]*60+hf[1])
            throw new ApiException("ValidationError", "heureFin doit être après heureDebut", 400);
    }

    @Transactional(readOnly = true)
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
        Indisponibilite i = new Indisponibilite();
        i.setIndispoId(UUID.randomUUID().toString());
        i.setPraticienId(praticienId);
        i.setDateDebut(req.dateDebut());
        i.setDateFin(req.dateFin());
        i.setMotif(req.motif() != null ? req.motif() : "");
        i.setRecurrente(false);
        return indispoRepo.save(i);
    }

    @Transactional(readOnly = true)
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

        if (!isCreneauDisponible(req.praticienId(), req.date(), req.heure(), duree))
            throw new ApiException("SlotAlreadyTakenException", "Ce créneau n'est pas disponible", 409);

        RendezVous rdv = new RendezVous();
        rdv.setRdvId(UUID.randomUUID().toString());
        rdv.setPraticienId(req.praticienId());
        rdv.setPatientId(patientId);
        rdv.setDate(req.date());
        rdv.setHeure(req.heure());
        rdv.setDuree(duree);
        rdv.setStatut(RendezVousStatut.PLANIFIE);
        return rdvRepo.save(rdv);
    }

    public boolean isCreneauDisponible(String praticienId, String date, String heure, int duree) {
        LocalDateTime debut = LocalDateTime.parse(date + "T" + heure);
        LocalDateTime fin = debut.plusMinutes(duree);

        // Vérifier indisponibilités
        for (var indispo : indispoRepo.findByPraticienId(praticienId)) {
            LocalDateTime id = LocalDateTime.parse(indispo.getDateDebut());
            LocalDateTime ifin = LocalDateTime.parse(indispo.getDateFin());
            if (debut.isBefore(ifin) && fin.isAfter(id)) return false;
        }
        // Vérifier RDV existants
        for (var rdv : rdvRepo.findByPraticienIdAndDate(praticienId, date)) {
            if (rdv.getStatut() == RendezVousStatut.ANNULE || rdv.getStatut() == RendezVousStatut.NON_VENU) continue;
            LocalDateTime rd = LocalDateTime.parse(rdv.getDate() + "T" + rdv.getHeure());
            LocalDateTime rf = rd.plusMinutes(rdv.getDuree() != null ? rdv.getDuree() : DUREE_DEFAULT);
            if (debut.isBefore(rf) && fin.isAfter(rd)) return false;
        }
        // Vérifier disponibilités
        String jourSemaine = JOURS_COMPLET.get(LocalDate.parse(date).getDayOfWeek().getValue() % 7);
        var dispo = dispoRepo.findByPraticienIdAndJourSemaine(praticienId, jourSemaine);
        int[] h = parseHeure(heure);
        int debutMin = h[0]*60 + h[1], finMin = debutMin + duree;
        for (var d : dispo) {
            int[] dd = parseHeure(d.getHeureDebut()), df = parseHeure(d.getHeureFin());
            if (debutMin >= dd[0]*60+dd[1] && finMin <= df[0]*60+df[1]) return true;
        }
        return false;
    }

    @Transactional(readOnly = true)
    public PagedResponse<RendezVous> listRendezVous(String userId, String type, String statut, int page, int limit) {
        PageRequest pr = PageRequest.of(page - 1, limit);
        Page<RendezVous> result;
        if ("PATIENT".equals(type)) {
            result = statut != null ? rdvRepo.findByPatientIdAndStatut(userId, RendezVousStatut.valueOf(statut), pr)
                                    : rdvRepo.findByPatientId(userId, pr);
        } else {
            result = statut != null ? rdvRepo.findByPraticienIdAndStatut(userId, RendezVousStatut.valueOf(statut), pr)
                                    : rdvRepo.findByPraticienId(userId, pr);
        }
        return new PagedResponse<>(result.getContent(), result.getTotalElements(), page, limit);
    }

    public RendezVous updateStatut(String rdvId, RendezVousStatut newStatut, String userId, String userType) {
        RendezVous rdv = rdvRepo.findById(rdvId)
            .orElseThrow(() -> new ApiException("NotFound", "Rendez-vous non trouvé", 404));
        if (!rdv.getPatientId().equals(userId) && !rdv.getPraticienId().equals(userId))
            throw new ApiException("Forbidden", "Non autorisé à modifier ce rendez-vous", 403);

        Map<RendezVousStatut, List<RendezVousStatut>> transitions = Map.of(
            RendezVousStatut.PLANIFIE, List.of(RendezVousStatut.CONFIRME, RendezVousStatut.ANNULE, RendezVousStatut.NON_VENU),
            RendezVousStatut.CONFIRME, List.of(RendezVousStatut.EN_COURS, RendezVousStatut.ANNULE, RendezVousStatut.NON_VENU),
            RendezVousStatut.EN_COURS, List.of(RendezVousStatut.TERMINE, RendezVousStatut.ANNULE),
            RendezVousStatut.TERMINE, List.of(),
            RendezVousStatut.ANNULE, List.of(),
            RendezVousStatut.NON_VENU, List.of()
        );
        if (!transitions.getOrDefault(rdv.getStatut(), List.of()).contains(newStatut))
            throw new ApiException("InvalidStateException", "Transition " + rdv.getStatut() + " → " + newStatut + " impossible", 409);

        if (newStatut == RendezVousStatut.ANNULE) {
            LocalDateTime rdvTime = LocalDateTime.parse(rdv.getDate() + "T" + rdv.getHeure());
            if (Duration.between(LocalDateTime.now(), rdvTime).toHours() < 2)
                throw new ApiException("CancellationTooLateException", "Annulation impossible moins de 2h avant", 409);
        }
        if ((newStatut == RendezVousStatut.EN_COURS || newStatut == RendezVousStatut.TERMINE || newStatut == RendezVousStatut.NON_VENU)
            && (!"PRATICIEN".equals(userType) || !rdv.getPraticienId().equals(userId)))
            throw new ApiException("Forbidden", "Seul le praticien peut effectuer cette action", 403);

        rdv.setStatut(newStatut);
        return rdvRepo.save(rdv);
    }

    // ========== Créneaux ==========
    @Transactional(readOnly = true)
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
                    if (!isOccupe(cur, finCreneau, indispos, rdvs)) {
                        creneaux.add(new Creneau(dateStr, cur.format(DateTimeFormatter.ofPattern("HH:mm")), DUREE_DEFAULT));
                    }
                    cur = cur.plusMinutes(DUREE_DEFAULT);
                }
            }
        }
        return creneaux;
    }

    private boolean isOccupe(LocalDateTime debut, LocalDateTime fin,
                             List<Indisponibilite> indispos, List<RendezVous> rdvs) {
        for (var i : indispos) {
            LocalDateTime id = LocalDateTime.parse(i.getDateDebut());
            LocalDateTime ifin = LocalDateTime.parse(i.getDateFin());
            if (debut.isBefore(ifin) && fin.isAfter(id)) return true;
        }
        for (var r : rdvs) {
            if (r.getStatut() == RendezVousStatut.ANNULE || r.getStatut() == RendezVousStatut.NON_VENU) continue;
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
        if (rdv.getStatut() != RendezVousStatut.TERMINE)
            throw new ApiException("ConsultationNotFinalizedException", "Le RDV doit être TERMINE", 409);
        if (!rdv.getPraticienId().equals(currentUserId))
            throw new ApiException("Forbidden", "Vous n'êtes pas le praticien de ce RDV", 403);
        if (crRepo.existsByRdvId(rdvId))
            throw new ApiException("Conflict", "Un compte rendu existe déjà pour ce RDV", 409);

        CompteRendu cr = new CompteRendu();
        cr.setCompteRenduId(UUID.randomUUID().toString());
        cr.setRdvId(rdvId);
        cr.setPraticienId(rdv.getPraticienId());
        cr.setPatientId(rdv.getPatientId());
        cr.setContenu(contenu);
        cr.setDateFinalisation(Instant.now().toString());
        return crRepo.save(cr);
    }

    @Transactional(readOnly = true)
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
}
