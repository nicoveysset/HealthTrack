package com.healthtrack.rdv.service;

import com.healthtrack.rdv.dto.DisponibilitesRequest.DispoItem;
import com.healthtrack.rdv.dto.RendezVousRequest;
import com.healthtrack.rdv.exception.*;
import com.healthtrack.rdv.model.*;
import com.healthtrack.rdv.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.*;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Horloge figée au jeudi 26/11/2026 10:00 (heure de Paris). */
class RdvServiceTest {

    private DisponibiliteRepository dispoRepo;
    private IndisponibiliteRepository indispoRepo;
    private RendezVousRepository rdvRepo;
    private PraticienRepository userRepo;
    private RdvService service;

    @BeforeEach
    void setUp() {
        dispoRepo = mock(DisponibiliteRepository.class);
        indispoRepo = mock(IndisponibiliteRepository.class);
        rdvRepo = mock(RendezVousRepository.class);
        userRepo = mock(PraticienRepository.class);
        Clock clock = Clock.fixed(ZonedDateTime.of(2026, 11, 26, 10, 0, 0, 0, ZoneId.of("Europe/Paris")).toInstant(), ZoneId.of("Europe/Paris"));
        service = new RdvService(dispoRepo, indispoRepo, rdvRepo, mock(CompteRenduRepository.class), userRepo, clock);
        when(rdvRepo.save(any())).thenAnswer(i -> i.getArgument(0));

        praticien("doc", "ACTIF");
        Disponibilite d = new Disponibilite();
        d.setJourSemaine("VENDREDI"); d.setHeureDebut("09:00"); d.setHeureFin("12:00");
        when(dispoRepo.findByPraticienIdAndJour("doc", "VENDREDI")).thenReturn(List.of(d));
        when(dispoRepo.findByPraticienIdAndJour("doc", "JEUDI")).thenReturn(List.of(d));
    }

    private void praticien(String id, String statut) {
        PraticienReference p = new PraticienReference();
        p.setUserId(id); p.setType("PRATICIEN"); p.setStatut(statut); p.setName("Dr Test");
        when(userRepo.findById(id)).thenReturn(Optional.of(p));
    }

    private RendezVousRequest req(String praticien, String date, String heure) {
        return new RendezVousRequest(praticien, date, heure, 30, "Consultation", null);
    }

    @Test
    @DisplayName("Prise de RDV valide (vendredi 27/11 10:00)")
    void rdvOk() {
        RendezVous rdv = service.createRendezVous("pat", "PATIENT", "Alice", req("doc", "2026-11-27", "10:00"));
        assertThat(rdv.getStatut()).isEqualTo("PLANIFIE");
        assertThat(rdv.getPraticienNom()).isEqualTo("Dr Test");
    }

    @Test
    @DisplayName("RDV dans le passé (heure de Paris) → PastDateException")
    void rdvPasse() {
        assertThatThrownBy(() -> service.createRendezVous("pat", "PATIENT", "Alice", req("doc", "2026-11-26", "09:30")))
            .isInstanceOf(PastDateException.class);
    }

    @Test
    @DisplayName("Praticien EN_CONGE → PractitionerNotAvailableException")
    void praticienEnConge() {
        praticien("conge", "EN_CONGE");
        assertThatThrownBy(() -> service.createRendezVous("pat", "PATIENT", "Alice", req("conge", "2026-11-27", "10:00")))
            .isInstanceOf(PractitionerNotAvailableException.class);
    }

    @Test
    @DisplayName("Praticien INACTIF tente de créer un RDV → PractitionerNotAvailableException")
    void praticienInactifCreeRdv() {
        praticien("inactif", "INACTIF");
        PraticienReference patient = new PraticienReference();
        patient.setUserId("pat"); patient.setType("PATIENT");
        when(userRepo.findById("pat")).thenReturn(Optional.of(patient));
        RendezVousRequest r = new RendezVousRequest("inactif", "2026-11-27", "10:00", 30, null, "pat");
        assertThatThrownBy(() -> service.createRendezVous("inactif", "PRATICIEN", "Dr", r))
            .isInstanceOf(PractitionerNotAvailableException.class);
    }

    @Test
    @DisplayName("RDV pendant une indisponibilité ponctuelle → PractitionerUnavailableException")
    void rdvPendantIndispo() {
        Indisponibilite i = new Indisponibilite();
        i.setDateDebut("2026-11-27T00:00"); i.setDateFin("2026-11-27T23:59");
        when(indispoRepo.findByPraticienId("doc")).thenReturn(List.of(i));
        assertThatThrownBy(() -> service.createRendezVous("pat", "PATIENT", "Alice", req("doc", "2026-11-27", "10:00")))
            .isInstanceOf(PractitionerUnavailableException.class);
    }

    @Test
    @DisplayName("Créneau déjà occupé (chevauchement partiel) → SlotAlreadyTakenException")
    void creneauOccupe() {
        RendezVous existant = new RendezVous();
        existant.setRdvId("r1"); existant.setDate("2026-11-27"); existant.setHeure("09:45"); existant.setDuree(30); existant.setStatut("CONFIRME");
        when(rdvRepo.findByPraticienIdAndDate("doc", "2026-11-27")).thenReturn(List.of(existant));
        assertThatThrownBy(() -> service.createRendezVous("pat", "PATIENT", "Alice", req("doc", "2026-11-27", "10:00")))
            .isInstanceOf(SlotAlreadyTakenException.class);
    }

    @Test
    @DisplayName("Un RDV annulé libère le créneau")
    void creneauLibereParAnnulation() {
        RendezVous annule = new RendezVous();
        annule.setDate("2026-11-27"); annule.setHeure("10:00"); annule.setDuree(30); annule.setStatut("ANNULE");
        when(rdvRepo.findByPraticienIdAndDate("doc", "2026-11-27")).thenReturn(List.of(annule));
        assertThat(service.createRendezVous("pat", "PATIENT", "Alice", req("doc", "2026-11-27", "10:00"))).isNotNull();
    }

    @Test
    @DisplayName("Disponibilités qui se chevauchent → SlotOverlapException")
    void dispoChevauchement() {
        var items = List.of(new DispoItem("LUNDI", "09:00", "12:00"), new DispoItem("LUNDI", "11:30", "14:00"));
        assertThatThrownBy(() -> service.replaceDisponibilites("doc", items)).isInstanceOf(SlotOverlapException.class);
    }

    @Test
    @DisplayName("Annulation moins de 2h avant → CancellationTooLateException")
    void annulationTardive() {
        RendezVous rdv = new RendezVous();
        rdv.setRdvId("r1"); rdv.setPatientId("pat"); rdv.setPraticienId("doc");
        rdv.setDate("2026-11-26"); rdv.setHeure("11:30"); rdv.setDuree(30); rdv.setStatut("CONFIRME");
        when(rdvRepo.findById("r1")).thenReturn(Optional.of(rdv));
        assertThatThrownBy(() -> service.updateStatut("r1", "ANNULE", "pat", "PATIENT"))
            .isInstanceOf(CancellationTooLateException.class);
    }

    @Test
    @DisplayName("Annulation plus de 2h avant : acceptée")
    void annulationOk() {
        RendezVous rdv = new RendezVous();
        rdv.setRdvId("r1"); rdv.setPatientId("pat"); rdv.setPraticienId("doc");
        rdv.setDate("2026-11-26"); rdv.setHeure("12:30"); rdv.setDuree(30); rdv.setStatut("PLANIFIE");
        when(rdvRepo.findById("r1")).thenReturn(Optional.of(rdv));
        assertThat(service.updateStatut("r1", "ANNULE", "pat", "PATIENT").getStatut()).isEqualTo("ANNULE");
    }

    @Test
    @DisplayName("Seul le praticien passe un RDV EN_COURS")
    void enCoursPraticienSeulement() {
        RendezVous rdv = new RendezVous();
        rdv.setRdvId("r1"); rdv.setPatientId("pat"); rdv.setPraticienId("doc");
        rdv.setDate("2026-11-27"); rdv.setHeure("10:00"); rdv.setStatut("CONFIRME");
        when(rdvRepo.findById("r1")).thenReturn(Optional.of(rdv));
        assertThatThrownBy(() -> service.updateStatut("r1", "EN_COURS", "pat", "PATIENT")).isInstanceOf(ForbiddenException.class);
        assertThat(service.updateStatut("r1", "EN_COURS", "doc", "PRATICIEN").getStatut()).isEqualTo("EN_COURS");
    }

    @Test
    @DisplayName("Créneaux : pas de créneau passé ni pendant une indisponibilité")
    void creneaux() {
        Disponibilite d = new Disponibilite();
        d.setJourSemaine("JEUDI"); d.setHeureDebut("09:00"); d.setHeureFin("12:00");
        when(dispoRepo.findByPraticienId("doc")).thenReturn(List.of(d));
        Indisponibilite i = new Indisponibilite();
        i.setDateDebut("2026-11-26T11:00"); i.setDateFin("2026-11-26T12:00");
        when(indispoRepo.findByPraticienId("doc")).thenReturn(List.of(i));
        var creneaux = service.calculateCreneaux("doc", "2026-11-26", "2026-11-26");
        assertThat(creneaux).extracting("heure").containsExactly("10:30");
    }
}
