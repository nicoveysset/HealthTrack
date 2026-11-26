package com.healthtrack.ordonnances.service;

import com.healthtrack.ordonnances.dto.LigneRequest;
import com.healthtrack.ordonnances.exception.*;
import com.healthtrack.ordonnances.model.*;
import com.healthtrack.ordonnances.monitoring.BusinessAlerts;
import com.healthtrack.ordonnances.repository.*;
import com.healthtrack.ordonnances.repository.CompteRenduRepository.CompteRenduReference;
import com.healthtrack.ordonnances.repository.RendezVousRepository.RendezVousReference;
import com.healthtrack.ordonnances.service.OrdonnanceService.Caller;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.*;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class OrdonnanceServiceTest {

    private OrdonnanceRepository ordRepo;
    private LignePrescriptionRepository ligneRepo;
    private MedicamentRepository medRepo;
    private CompteRenduRepository crRepo;
    private RendezVousRepository rdvRepo;
    private AllergieRepository allergieRepo;
    private BusinessAlerts alerts;
    private OrdonnanceService service;

    private final Caller doc = new Caller("doc", "PRATICIEN", "Dr Martin");

    @BeforeEach
    void setUp() {
        ordRepo = mock(OrdonnanceRepository.class);
        ligneRepo = mock(LignePrescriptionRepository.class);
        medRepo = mock(MedicamentRepository.class);
        crRepo = mock(CompteRenduRepository.class);
        rdvRepo = mock(RendezVousRepository.class);
        allergieRepo = mock(AllergieRepository.class);
        alerts = mock(BusinessAlerts.class);
        Clock clock = Clock.fixed(Instant.parse("2026-11-26T10:00:00Z"), ZoneId.of("Europe/Paris"));
        service = new OrdonnanceService(ordRepo, ligneRepo, medRepo, crRepo, rdvRepo, allergieRepo, alerts, clock);
        when(ordRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(ligneRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(ordRepo.findByRdvId(any())).thenReturn(Optional.empty());

        Medicament m = new Medicament();
        m.setMedicamentId("m1"); m.setNom("Amoxicilline 500 mg"); m.setSubstanceActive("Amoxicilline");
        when(medRepo.findById("m1")).thenReturn(Optional.of(m));
    }

    private void rdv(String statut, String praticien) {
        RendezVousReference r = new RendezVousReference();
        r.setRdvId("r1"); r.setPatientId("pat"); r.setPraticienId(praticien); r.setStatut(statut);
        when(rdvRepo.findById("r1")).thenReturn(Optional.of(r));
    }

    private void compteRendu(boolean finalise) {
        CompteRenduReference cr = new CompteRenduReference();
        cr.setCompteRenduId("cr1"); cr.setRdvId("r1");
        cr.setDateFinalisation(finalise ? "2026-11-26T09:00:00Z" : null);
        when(crRepo.findByRdvId("r1")).thenReturn(Optional.of(cr));
    }

    private Ordonnance ordonnance(String dateValidite) {
        Ordonnance o = new Ordonnance();
        o.setOrdonnanceId("o1"); o.setPatientId("pat"); o.setPraticienId("doc");
        o.setStatut("ACTIVE"); o.setDateValidite(dateValidite);
        when(ordRepo.findById("o1")).thenReturn(Optional.of(o));
        return o;
    }

    @Test
    @DisplayName("Création sur un RDV non TERMINE → ConsultationNotFinalizedException")
    void rdvNonTermine() {
        rdv("CONFIRME", "doc");
        assertThatThrownBy(() -> service.createOrdonnance("r1", doc)).isInstanceOf(ConsultationNotFinalizedException.class);
    }

    @Test
    @DisplayName("Compte rendu non finalisé → ConsultationNotFinalizedException")
    void compteRenduNonFinalise() {
        rdv("TERMINE", "doc");
        compteRendu(false);
        assertThatThrownBy(() -> service.createOrdonnance("r1", doc)).isInstanceOf(ConsultationNotFinalizedException.class);
    }

    @Test
    @DisplayName("Praticien n'ayant pas réalisé la consultation → ForbiddenException")
    void autrePraticien() {
        rdv("TERMINE", "autreDoc");
        compteRendu(true);
        assertThatThrownBy(() -> service.createOrdonnance("r1", doc)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("Création valide : ACTIVE, validité 3 mois")
    void creationOk() {
        rdv("TERMINE", "doc");
        compteRendu(true);
        Ordonnance o = service.createOrdonnance("r1", doc);
        assertThat(o.getStatut()).isEqualTo("ACTIVE");
        assertThat(o.getDateValidite()).startsWith("2027-02-26");
    }

    @Test
    @DisplayName("Médicament allergène → AllergyConflictException + alerte CloudWatch")
    void conflitAllergie() {
        ordonnance("2027-02-26T23:59:59");
        when(allergieRepo.conflictsWith("pat", "Amoxicilline 500 mg", "Amoxicilline")).thenReturn(true);
        assertThatThrownBy(() -> service.addLigne("o1", new LigneRequest("m1", "1 cp", 7, null), doc))
            .isInstanceOf(AllergyConflictException.class);
        verify(alerts).allergyConflict(eq("o1"), eq("doc"), eq("pat"), any(), any());
        verify(ligneRepo, never()).save(any());
    }

    @Test
    @DisplayName("Ligne > 90 jours : acceptée + alerte métier CloudWatch")
    void alerteLongueDuree() {
        ordonnance("2027-02-26T23:59:59");
        service.addLigne("o1", new LigneRequest("m1", "1 cp", 120, null), doc);
        verify(alerts).longPrescription(eq("o1"), any(), eq("doc"), eq("pat"), any(), eq(120));
    }

    @Test
    @DisplayName("Ligne de 90 jours : pas d'alerte")
    void pasAlerte() {
        ordonnance("2027-02-26T23:59:59");
        service.addLigne("o1", new LigneRequest("m1", "1 cp", 90, null), doc);
        verify(alerts, never()).longPrescription(any(), any(), any(), any(), any(), anyInt());
    }

    @Test
    @DisplayName("Modification d'une ordonnance EXPIREE → PrescriptionExpiredException (ajout et retrait)")
    void ordonnanceExpiree() {
        Ordonnance o = ordonnance("2026-10-01T23:59:59");
        assertThatThrownBy(() -> service.addLigne("o1", new LigneRequest("m1", "1 cp", 5, null), doc))
            .isInstanceOf(PrescriptionExpiredException.class);
        assertThat(o.getStatut()).isEqualTo("EXPIREE");
        assertThatThrownBy(() -> service.deleteLigne("o1", "l1", doc)).isInstanceOf(PrescriptionExpiredException.class);
    }

    @Test
    @DisplayName("Ordonnances d'un patient jamais consulté → AccessDeniedException")
    void listeSansConsultation() {
        when(rdvRepo.hasConsulted("pat", "doc")).thenReturn(false);
        assertThatThrownBy(() -> service.listOrdonnances(doc, "pat", null, null, 1, 10)).isInstanceOf(AccessDeniedException.class);
    }
}
