package com.healthtrack.dossiers.service;

import com.healthtrack.dossiers.dto.*;
import com.healthtrack.dossiers.exception.*;
import com.healthtrack.dossiers.model.*;
import com.healthtrack.dossiers.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * Règles métier du dossier médical.
 * <ul>
 *   <li>Praticien sans consultation antérieure avec le patient → {@link AccessDeniedException}</li>
 *   <li>Archivage d'un antécédent CHRONIQUE → {@link ChronicConditionCannotBeArchivedException}</li>
 *   <li>Suppression d'une allergie liée à une ordonnance active → {@link AllergyLinkedToActivePrescriptionException}</li>
 *   <li>Modification d'une allergie : trace CloudWatch avec l'identité du praticien (événement ALLERGIE_UPDATED)</li>
 * </ul>
 * Le dossier d'un patient a pour identifiant l'identifiant du patient.
 */
@Service
public class DossierService {

    private static final Logger log = LoggerFactory.getLogger(DossierService.class);
    private static final Set<String> GROUPES_SANGUINS = Set.of("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-");

    /** Identité de l'utilisateur connecté (extraite du JWT). */
    public record Caller(String userId, String type, String name) {
        boolean isPraticien() { return "PRATICIEN".equals(type); }
    }

    private final DossierRepository dossierRepo;
    private final AntecedentRepository antecedentRepo;
    private final AllergieRepository allergieRepo;
    private final VaccinationRepository vaccinationRepo;
    private final RendezVousAccessRepository rendezVousRepo;
    private final PrescriptionLookupRepository prescriptionRepo;
    private final Clock clock;

    public DossierService(DossierRepository d, AntecedentRepository a, AllergieRepository al, VaccinationRepository v,
                          RendezVousAccessRepository rendezVousRepo, PrescriptionLookupRepository prescriptionRepo, Clock clock) {
        this.dossierRepo = d;
        this.antecedentRepo = a;
        this.allergieRepo = al;
        this.vaccinationRepo = v;
        this.rendezVousRepo = rendezVousRepo;
        this.prescriptionRepo = prescriptionRepo;
        this.clock = clock;
    }

    // ========== Contrôle d'accès ==========

    /** Le patient accède à son propre dossier ; un praticien uniquement s'il a déjà consulté ce patient. */
    void checkAccess(String patientId, Caller caller) {
        if ("PATIENT".equals(caller.type())) {
            if (caller.userId().equals(patientId)) return;
            throw new ForbiddenException("Un patient ne peut consulter que son propre dossier");
        }
        if (caller.isPraticien()) {
            if (rendezVousRepo.hasCompletedAppointment(patientId, caller.userId())) return;
            log.warn("{\"event\":\"DOSSIER_ACCESS_DENIED\",\"patientId\":\"{}\",\"praticienId\":\"{}\"}", patientId, caller.userId());
            throw new AccessDeniedException("Accès refusé : vous n'avez aucune consultation antérieure avec ce patient");
        }
        throw new ForbiddenException("Type d'utilisateur inconnu");
    }

    private DossierMedical getOrCreateDossier(String patientId) {
        return dossierRepo.findById(patientId).orElseGet(() -> {
            String now = Instant.now(clock).toString();
            DossierMedical d = new DossierMedical();
            d.setPatientId(patientId);
            d.setGroupeSanguin("");
            d.setDateCreation(now);
            d.setUpdatedAt(now);
            return dossierRepo.save(d);
        });
    }

    // ========== Dossier ==========

    public DossierComplet getDossierComplet(String patientId, Caller caller) {
        checkAccess(patientId, caller);
        DossierMedical dossier = getOrCreateDossier(patientId);
        log.info("{\"event\":\"DOSSIER_CONSULTED\",\"patientId\":\"{}\",\"by\":\"{}\",\"byType\":\"{}\"}", patientId, caller.userId(), caller.type());
        return new DossierComplet(dossier,
            sortAntecedents(antecedentRepo.findByDossierId(patientId)),
            allergieRepo.findByPatientId(patientId),
            vaccinationRepo.findByDossierId(patientId).stream()
                .sorted(Comparator.comparing(Vaccination::getDate, Comparator.nullsLast(Comparator.reverseOrder()))).toList());
    }

    public DossierMedical updateDossier(String patientId, DossierUpdate req, Caller caller) {
        checkAccess(patientId, caller);
        DossierMedical dossier = getOrCreateDossier(patientId);
        if (req.groupeSanguin() != null) {
            String gs = req.groupeSanguin().trim().toUpperCase(Locale.ROOT);
            if (!gs.isEmpty() && !GROUPES_SANGUINS.contains(gs))
                throw new ValidationException("groupeSanguin invalide (valeurs possibles : " + new TreeSet<>(GROUPES_SANGUINS) + ")");
            dossier.setGroupeSanguin(gs);
        }
        dossier.setUpdatedAt(Instant.now(clock).toString());
        log.info("{\"event\":\"DOSSIER_UPDATED\",\"patientId\":\"{}\",\"by\":\"{}\",\"byType\":\"{}\"}", patientId, caller.userId(), caller.type());
        return dossierRepo.save(dossier);
    }

    // ========== Antécédents ==========

    public List<Antecedent> listAntecedents(String patientId, String statut, Caller caller) {
        checkAccess(patientId, caller);
        String s = statut != null && !statut.isBlank() ? parseEnum(AntecedentStatut.class, statut, "statut").name() : null;
        return sortAntecedents(antecedentRepo.findByDossierId(patientId)).stream()
            .filter(a -> s == null || s.equals(a.getStatut()))
            .toList();
    }

    public Antecedent createAntecedent(String patientId, AntecedentRequest req, Caller caller) {
        checkAccess(patientId, caller);
        getOrCreateDossier(patientId);
        String now = Instant.now(clock).toString();
        Antecedent a = new Antecedent();
        a.setAntecedentId(UUID.randomUUID().toString());
        a.setDossierId(patientId);
        a.setLibelle(req.libelle().trim());
        a.setType(parseEnum(AntecedentType.class, req.type(), "type").name());
        a.setDate(req.date() != null && !req.date().isBlank() ? parsePastDate(req.date(), "date") : LocalDate.now(clock).toString());
        a.setStatut(AntecedentStatut.ACTIF.name());
        a.setDescription(req.description() != null ? req.description().trim() : "");
        a.setCreatedAt(now);
        a.setUpdatedAt(now);
        Antecedent saved = antecedentRepo.save(a);
        log.info("{\"event\":\"ANTECEDENT_CREATED\",\"antecedentId\":\"{}\",\"patientId\":\"{}\",\"by\":\"{}\",\"byType\":\"{}\"}",
            saved.getAntecedentId(), patientId, caller.userId(), caller.type());
        return saved;
    }

    /** Modification partielle ; statut=ARCHIVE archive l'antécédent, statut=ACTIF le réactive. */
    public Antecedent updateAntecedent(String id, AntecedentUpdate req, Caller caller) {
        Antecedent a = findAntecedent(id);
        checkAccess(a.getDossierId(), caller);
        if (req.libelle() != null) {
            if (req.libelle().isBlank()) throw new ValidationException("libelle ne peut pas être vide");
            a.setLibelle(req.libelle().trim());
        }
        if (req.type() != null) a.setType(parseEnum(AntecedentType.class, req.type(), "type").name());
        if (req.date() != null) a.setDate(parsePastDate(req.date(), "date"));
        if (req.description() != null) a.setDescription(req.description().trim());
        if (req.statut() != null) {
            AntecedentStatut statut = parseEnum(AntecedentStatut.class, req.statut(), "statut");
            if (statut == AntecedentStatut.ARCHIVE) ensureArchivable(a);
            a.setStatut(statut.name());
        }
        a.setUpdatedAt(Instant.now(clock).toString());
        log.info("{\"event\":\"ANTECEDENT_UPDATED\",\"antecedentId\":\"{}\",\"patientId\":\"{}\",\"by\":\"{}\",\"byType\":\"{}\"}",
            id, a.getDossierId(), caller.userId(), caller.type());
        return antecedentRepo.save(a);
    }

    public Antecedent archiveAntecedent(String id, Caller caller) {
        return updateAntecedent(id, new AntecedentUpdate(null, null, null, null, AntecedentStatut.ARCHIVE.name()), caller);
    }

    private void ensureArchivable(Antecedent a) {
        if (AntecedentType.CHRONIQUE.name().equals(a.getType()))
            throw new ChronicConditionCannotBeArchivedException("L'antécédent chronique « " + a.getLibelle() + " » ne peut pas être archivé");
    }

    private Antecedent findAntecedent(String id) {
        return antecedentRepo.findById(id).orElseThrow(() -> new NotFoundException("Antécédent " + id + " non trouvé"));
    }

    private List<Antecedent> sortAntecedents(List<Antecedent> list) {
        return list.stream()
            .sorted(Comparator.comparing(Antecedent::getStatut, Comparator.nullsLast(Comparator.<String>naturalOrder())).thenComparing(Antecedent::getDate, Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();
    }

    // ========== Allergies ==========

    /** Liste des allergies d'un patient (utilisée par le praticien lors de la prescription). */
    public List<Allergie> listAllergies(String patientId, Caller caller) {
        checkAccess(patientId, caller);
        return allergieRepo.findByPatientId(patientId);
    }

    public Allergie createAllergie(String patientId, AllergieRequest req, Caller caller) {
        checkAccess(patientId, caller);
        getOrCreateDossier(patientId);
        String medicament = req.medicamentConcerne().trim();
        boolean doublon = allergieRepo.findByPatientId(patientId).stream()
            .anyMatch(x -> x.getMedicamentConcerne() != null && x.getMedicamentConcerne().equalsIgnoreCase(medicament));
        if (doublon) throw new ConflictException("Une allergie à « " + medicament + " » est déjà enregistrée pour ce patient");

        String now = Instant.now(clock).toString();
        Allergie a = new Allergie();
        a.setAllergieId(UUID.randomUUID().toString());
        a.setPatientId(patientId);
        a.setMedicamentConcerne(medicament);
        a.setSeverite(parseEnum(AllergieSeverite.class, req.severite(), "severite").name());
        a.setDateDecouverte(req.dateDecouverte() != null && !req.dateDecouverte().isBlank()
            ? parsePastDate(req.dateDecouverte(), "dateDecouverte") : LocalDate.now(clock).toString());
        a.setDescription(req.description() != null ? req.description().trim() : "");
        a.setCreatedAt(now);
        a.setUpdatedAt(now);
        Allergie saved = allergieRepo.save(a);
        log.info("{\"event\":\"ALLERGIE_CREATED\",\"allergieId\":\"{}\",\"patientId\":\"{}\",\"medicament\":\"{}\",\"severite\":\"{}\",\"by\":\"{}\",\"byType\":\"{}\",\"byName\":\"{}\"}",
            saved.getAllergieId(), patientId, saved.getMedicamentConcerne(), saved.getSeverite(), caller.userId(), caller.type(), caller.name());
        return saved;
    }

    /** Modification d'une allergie — trace obligatoire dans CloudWatch avec l'identité du praticien. */
    public Allergie updateAllergie(String id, AllergieUpdate req, Caller caller) {
        Allergie a = findAllergie(id);
        checkAccess(a.getPatientId(), caller);
        Map<String, String> avant = new LinkedHashMap<>();
        Map<String, String> apres = new LinkedHashMap<>();

        if (req.medicamentConcerne() != null) {
            if (req.medicamentConcerne().isBlank()) throw new ValidationException("medicamentConcerne ne peut pas être vide");
            track(avant, apres, "medicamentConcerne", a.getMedicamentConcerne(), req.medicamentConcerne().trim());
            a.setMedicamentConcerne(req.medicamentConcerne().trim());
        }
        if (req.severite() != null) {
            String s = parseEnum(AllergieSeverite.class, req.severite(), "severite").name();
            track(avant, apres, "severite", a.getSeverite(), s);
            a.setSeverite(s);
        }
        if (req.dateDecouverte() != null) {
            String d = parsePastDate(req.dateDecouverte(), "dateDecouverte");
            track(avant, apres, "dateDecouverte", a.getDateDecouverte(), d);
            a.setDateDecouverte(d);
        }
        if (req.description() != null) {
            track(avant, apres, "description", a.getDescription(), req.description().trim());
            a.setDescription(req.description().trim());
        }
        a.setUpdatedAt(Instant.now(clock).toString());
        Allergie saved = allergieRepo.save(a);

        // Trace d'audit exigée par le sujet : qui (praticien), quoi (allergie), avant / après.
        log.info("{\"event\":\"ALLERGIE_UPDATED\",\"allergieId\":\"{}\",\"patientId\":\"{}\",\"praticienId\":\"{}\",\"praticienNom\":\"{}\",\"modifiedByType\":\"{}\",\"avant\":\"{}\",\"apres\":\"{}\"}",
            id, a.getPatientId(), caller.isPraticien() ? caller.userId() : "", caller.isPraticien() ? caller.name() : "",
            caller.type(), avant, apres);
        return saved;
    }

    public void deleteAllergie(String id, Caller caller) {
        Allergie a = findAllergie(id);
        checkAccess(a.getPatientId(), caller);
        if (prescriptionRepo.isAllergyLinkedToActivePrescription(a.getPatientId(), a.getMedicamentConcerne()))
            throw new AllergyLinkedToActivePrescriptionException("L'allergie à « " + a.getMedicamentConcerne()
                + " » est liée à une ordonnance active et ne peut pas être supprimée");
        allergieRepo.deleteById(id);
        log.info("{\"event\":\"ALLERGIE_DELETED\",\"allergieId\":\"{}\",\"patientId\":\"{}\",\"medicament\":\"{}\",\"by\":\"{}\",\"byType\":\"{}\",\"byName\":\"{}\"}",
            id, a.getPatientId(), a.getMedicamentConcerne(), caller.userId(), caller.type(), caller.name());
    }

    private Allergie findAllergie(String id) {
        return allergieRepo.findById(id).orElseThrow(() -> new NotFoundException("Allergie " + id + " non trouvée"));
    }

    private static void track(Map<String, String> avant, Map<String, String> apres, String champ, String ancien, String nouveau) {
        if (!Objects.equals(ancien, nouveau)) {
            avant.put(champ, ancien);
            apres.put(champ, nouveau);
        }
    }

    // ========== Vaccinations ==========

    public List<Vaccination> listVaccinations(String patientId, Caller caller) {
        checkAccess(patientId, caller);
        return vaccinationRepo.findByDossierId(patientId);
    }

    public Vaccination createVaccination(String patientId, VaccinationRequest req, Caller caller) {
        checkAccess(patientId, caller);
        getOrCreateDossier(patientId);
        String date = parsePastDate(req.date(), "date");
        String rappel = null;
        if (req.rappelPrevu() != null && !req.rappelPrevu().isBlank()) {
            rappel = parseDate(req.rappelPrevu(), "rappelPrevu").toString();
            if (rappel.compareTo(date) <= 0) throw new ValidationException("rappelPrevu doit être postérieur à la date de vaccination");
        }
        String now = Instant.now(clock).toString();
        Vaccination v = new Vaccination();
        v.setVaccinationId(UUID.randomUUID().toString());
        v.setDossierId(patientId);
        v.setNomVaccin(req.nomVaccin().trim());
        v.setDate(date);
        v.setRappelPrevu(rappel);
        v.setDescription(req.description() != null ? req.description().trim() : "");
        v.setCreatedAt(now);
        v.setUpdatedAt(now);
        Vaccination saved = vaccinationRepo.save(v);
        log.info("{\"event\":\"VACCINATION_CREATED\",\"vaccinationId\":\"{}\",\"patientId\":\"{}\",\"by\":\"{}\",\"byType\":\"{}\"}",
            saved.getVaccinationId(), patientId, caller.userId(), caller.type());
        return saved;
    }

    // ========== Utilitaires ==========

    private static LocalDate parseDate(String value, String field) {
        try {
            return LocalDate.parse(value.trim().length() > 10 ? value.trim().substring(0, 10) : value.trim());
        } catch (RuntimeException e) {
            throw new ValidationException(field + " doit être une date valide au format YYYY-MM-DD");
        }
    }

    private String parsePastDate(String value, String field) {
        LocalDate d = parseDate(value, field);
        if (d.isAfter(LocalDate.now(clock))) throw new ValidationException(field + " ne peut pas être dans le futur");
        return d.toString();
    }

    static <E extends Enum<E>> E parseEnum(Class<E> type, String value, String field) {
        try {
            return Enum.valueOf(type, value.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException e) {
            throw new ValidationException(field + " invalide (valeurs possibles : " + Arrays.toString(type.getEnumConstants()) + ")");
        }
    }
}
