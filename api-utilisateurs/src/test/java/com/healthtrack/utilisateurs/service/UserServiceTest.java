package com.healthtrack.utilisateurs.service;

import com.healthtrack.utilisateurs.config.JwtService;
import com.healthtrack.utilisateurs.dto.RegisterRequest;
import com.healthtrack.utilisateurs.exception.*;
import com.healthtrack.utilisateurs.model.User;
import com.healthtrack.utilisateurs.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.*;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class UserServiceTest {

    private UserRepository repo;
    private UserService service;

    @BeforeEach
    void setUp() {
        repo = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        when(encoder.encode(any())).thenReturn("hash");
        JwtService jwt = mock(JwtService.class);
        when(jwt.generateToken(any(), any(), any(), any())).thenReturn("token");
        Clock clock = Clock.fixed(Instant.parse("2026-11-26T10:00:00Z"), ZoneId.of("Europe/Paris"));
        service = new UserService(repo, encoder, jwt, clock);
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(repo.update(anyString(), anyMap())).thenAnswer(i -> repo.findById(i.getArgument(0)).orElseThrow());
    }

    private User user(String id, String type, String specialite, String statut) {
        User u = new User();
        u.setUserId(id); u.setType(type); u.setSpecialite(specialite); u.setStatut(statut);
        when(repo.findById(id)).thenReturn(Optional.of(u));
        return u;
    }

    @Test
    @DisplayName("Email déjà utilisé → EmailAlreadyUsedException")
    void emailDejaUtilise() {
        when(repo.existsByEmail("a@b.fr")).thenReturn(true);
        RegisterRequest req = new RegisterRequest("a@b.fr", "Test1234!", "PATIENT", "A", "B", null, null, "1990-01-01", "1");
        assertThatThrownBy(() -> service.register(req)).isInstanceOf(EmailAlreadyUsedException.class);
    }

    @Test
    @DisplayName("Spécialité hors liste → 400")
    void specialiteInvalide() {
        RegisterRequest req = new RegisterRequest("a@b.fr", "Test1234!", "PRATICIEN", "A", "B", "PLOMBIER", "1", null, null);
        assertThatThrownBy(() -> service.register(req)).isInstanceOf(ValidationException.class);
    }

    @Test
    @DisplayName("Médecin traitant non généraliste → InvalidSpecialityException")
    void medecinTraitantNonGeneraliste() {
        user("pat", "PATIENT", null, null);
        user("cardio", "PRATICIEN", "CARDIOLOGUE", "ACTIF");
        assertThatThrownBy(() -> service.setMedecinTraitant("pat", "cardio")).isInstanceOf(InvalidSpecialityException.class);
    }

    @Test
    @DisplayName("Médecin traitant INACTIF → PractitionerNotAvailableException")
    void medecinTraitantInactif() {
        user("pat", "PATIENT", null, null);
        user("gen", "PRATICIEN", "GENERALISTE", "INACTIF");
        assertThatThrownBy(() -> service.setMedecinTraitant("pat", "gen")).isInstanceOf(PractitionerNotAvailableException.class);
    }

    @Test
    @DisplayName("Médecin traitant EN_CONGE : autorisé (seul INACTIF est bloqué)")
    void medecinTraitantEnConge() {
        user("pat", "PATIENT", null, null);
        user("gen", "PRATICIEN", "GENERALISTE", "EN_CONGE");
        service.setMedecinTraitant("pat", "gen");
        verify(repo).update("pat", Map.of("medecinTraitantId", "gen"));
    }

    @Test
    @DisplayName("Statut praticien invalide → 400")
    void statutInvalide() {
        user("gen", "PRATICIEN", "GENERALISTE", "ACTIF");
        assertThatThrownBy(() -> service.updatePraticienStatut("gen", "VACANCES")).isInstanceOf(ValidationException.class);
    }

    @Test
    @DisplayName("Pagination de la recherche de praticiens")
    void pagination() {
        var list = java.util.stream.IntStream.range(0, 25).mapToObj(i -> {
            User u = new User(); u.setUserId("p" + i); u.setType("PRATICIEN"); u.setLastName("Nom" + (100 + i)); return u;
        }).toList();
        when(repo.findPraticiens(null, null)).thenReturn(list);
        var page = service.listPraticiens(null, null, 3, 10);
        assertThat(page.items()).hasSize(5);
        assertThat(page.count()).isEqualTo(25);
    }
}
