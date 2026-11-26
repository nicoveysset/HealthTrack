package com.healthtrack.dossiers.service;

import com.healthtrack.dossiers.dto.AllergieUpdate;
import com.healthtrack.dossiers.dto.AntecedentUpdate;
import com.healthtrack.dossiers.exception.*;
import com.healthtrack.dossiers.model.*;
import com.healthtrack.dossiers.repository.*;
import com.healthtrack.dossiers.service.DossierService.Caller;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DossierServiceTest {

    private AntecedentRepository antecedentRepo;
    private AllergieRepository allergieRepo;
    private RendezVousAccessRepository rdvRepo;
    private PrescriptionLookupRepository prescriptionRepo;
    private DossierService service;

    private final Caller praticien = new Caller("doc", "PRATICIEN", "Dr Martin");
    private final Caller patient = new Caller("pat", "PATIENT", "Alice");

    @BeforeEach
    void setUp() {
        antecedentRepo = mock(AntecedentRepository.class);
        allergieRepo = mock(AllergieRepository.class);
        rdvRepo = mock(RendezVousAccessRepository.class);
        prescriptionRepo = mock(PrescriptionLookupRepository.class);
        service = new DossierService(mock(DossierRepository.class), antecedentRepo, allergieRepo, mock(VaccinationRepository.class),
            rdvRepo, prescriptionRepo, Clock.fixed(Instant.parse("2026-11-26T10:00:00Z"), ZoneId.of("Europe/Paris")));
        when(antecedentRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(allergieRepo.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    @DisplayName("Praticien sans consultation antérieure → AccessDeniedException")
    void accesRefuse() {
        when(rdvRepo.hasCompletedAppointment("pat", "doc")).thenReturn(false);
        assertThatThrownBy(() -> service.getDossierComplet("pat", praticien)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("Un patient ne lit pas le dossier d'un autre patient")
    void autrePatient() {
        assertThatThrownBy(() -> service.listAllergies("autre", patient)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("Archivage d'un antécédent CHRONIQUE → ChronicConditionCannotBeArchivedException")
    void archivageChronique() {
        Antecedent a = new Antecedent();
        a.setAntecedentId("a1"); a.setDossierId("pat"); a.setType("CHRONIQUE"); a.setStatut("ACTIF"); a.setLibelle("Diabète");
        when(antecedentRepo.findById("a1")).thenReturn(Optional.of(a));
        assertThatThrownBy(() -> service.updateAntecedent("a1", new AntecedentUpdate(null, null, null, null, "ARCHIVE"), patient))
            .isInstanceOf(ChronicConditionCannotBeArchivedException.class);
    }

    @Test
    @DisplayName("Archivage d'un antécédent PONCTUEL : accepté")
    void archivagePonctuel() {
        Antecedent a = new Antecedent();
        a.setAntecedentId("a1"); a.setDossierId("pat"); a.setType("PONCTUEL"); a.setStatut("ACTIF");
        when(antecedentRepo.findById("a1")).thenReturn(Optional.of(a));
        assertThat(service.archiveAntecedent("a1", patient).getStatut()).isEqualTo("ARCHIVE");
    }

    @Test
    @DisplayName("Suppression d'une allergie liée à une ordonnance active → AllergyLinkedToActivePrescriptionException")
    void suppressionAllergieLiee() {
        Allergie al = new Allergie();
        al.setAllergieId("al1"); al.setPatientId("pat"); al.setMedicamentConcerne("Amoxicilline");
        when(allergieRepo.findById("al1")).thenReturn(Optional.of(al));
        when(prescriptionRepo.isAllergyLinkedToActivePrescription("pat", "Amoxicilline")).thenReturn(true);
        assertThatThrownBy(() -> service.deleteAllergie("al1", patient)).isInstanceOf(AllergyLinkedToActivePrescriptionException.class);
        verify(allergieRepo, never()).deleteById(any());
    }

    @Test
    @DisplayName("Modification d'une allergie par un praticien ayant consulté le patient")
    void modificationAllergie() {
        when(rdvRepo.hasCompletedAppointment("pat", "doc")).thenReturn(true);
        Allergie al = new Allergie();
        al.setAllergieId("al1"); al.setPatientId("pat"); al.setMedicamentConcerne("Ibuprofène"); al.setSeverite("LEGERE");
        when(allergieRepo.findById("al1")).thenReturn(Optional.of(al));
        Allergie res = service.updateAllergie("al1", new AllergieUpdate(null, "severe", null, null), praticien);
        assertThat(res.getSeverite()).isEqualTo("SEVERE");
    }

    @Test
    @DisplayName("Sévérité invalide → 400")
    void severiteInvalide() {
        Allergie al = new Allergie();
        al.setAllergieId("al1"); al.setPatientId("pat");
        when(allergieRepo.findById("al1")).thenReturn(Optional.of(al));
        assertThatThrownBy(() -> service.updateAllergie("al1", new AllergieUpdate(null, "GRAVE", null, null), patient))
            .isInstanceOf(ValidationException.class);
    }
}
