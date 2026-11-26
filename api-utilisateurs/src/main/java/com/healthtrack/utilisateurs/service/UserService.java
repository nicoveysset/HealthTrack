package com.healthtrack.utilisateurs.service;

import com.healthtrack.utilisateurs.config.JwtService;
import com.healthtrack.utilisateurs.dto.*;
import com.healthtrack.utilisateurs.exception.*;
import com.healthtrack.utilisateurs.model.*;
import com.healthtrack.utilisateurs.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Règles métier de l'API Utilisateurs.
 * <ul>
 *   <li>Email déjà utilisé → {@link EmailAlreadyUsedException}</li>
 *   <li>Médecin traitant non généraliste → {@link InvalidSpecialityException}</li>
 *   <li>Médecin traitant INACTIF → {@link PractitionerNotAvailableException}</li>
 * </ul>
 */
@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private static final int MAX_LIMIT = 100;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final Clock clock;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService, Clock clock) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.clock = clock;
    }

    // ========== Inscription / connexion ==========

    public AuthResponse register(RegisterRequest req) {
        UserType type = parseEnum(UserType.class, req.type(), "type");
        String email = req.email().trim().toLowerCase(Locale.ROOT);

        User user = new User();
        if (type == UserType.PRATICIEN) {
            user.setSpecialite(parseEnum(Specialite.class, required(req.specialite(), "specialite"), "specialite").name());
            user.setRpps(required(req.rpps(), "rpps"));
            user.setStatut(PraticienStatut.ACTIF.name());
        } else {
            user.setDateNaissance(validateDateNaissance(required(req.dateNaissance(), "dateNaissance")));
            user.setNss(required(req.nss(), "nss"));
        }

        if (userRepository.existsByEmail(email))
            throw new EmailAlreadyUsedException("Un utilisateur avec l'email " + email + " existe déjà");

        String now = Instant.now(clock).toString();
        user.setUserId(UUID.randomUUID().toString());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setType(type.name());
        user.setFirstName(req.firstName().trim());
        user.setLastName(req.lastName().trim());
        user.setName(user.getFirstName() + " " + user.getLastName());
        user.setCreatedAt(now);
        user.setUpdatedAt(now);

        User saved = userRepository.save(user);
        log.info("{\"event\":\"USER_REGISTERED\",\"userId\":\"{}\",\"type\":\"{}\"}", saved.getUserId(), saved.getType());
        return new AuthResponse(UserResponse.from(saved), token(saved));
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.email().trim().toLowerCase(Locale.ROOT))
            .orElseThrow(InvalidCredentialsException::new);
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash()))
            throw new InvalidCredentialsException();
        log.info("{\"event\":\"USER_LOGIN\",\"userId\":\"{}\"}", user.getUserId());
        return new AuthResponse(UserResponse.from(user), token(user));
    }

    private String token(User u) {
        return jwtService.generateToken(u.getUserId(), u.getEmail(), u.getType(), u.getName());
    }

    // ========== Profil ==========

    public UserResponse getProfile(String userId) {
        return UserResponse.from(findUser(userId));
    }

    /**
     * Consultation du profil d'un autre utilisateur :
     * un praticien est visible par tous ; un patient n'est visible que par les praticiens.
     */
    public UserResponse getUser(String targetId, String currentUserId, String currentUserType) {
        User target = findUser(targetId);
        boolean self = target.getUserId().equals(currentUserId);
        if (!self && "PATIENT".equals(target.getType()) && !"PRATICIEN".equals(currentUserType))
            throw new ForbiddenException("Seul un praticien peut consulter le profil d'un patient");
        return UserResponse.from(target);
    }

    public UserResponse updateProfile(String userId, UpdateProfileRequest req) {
        User user = findUser(userId);
        Map<String, Object> updates = new HashMap<>();
        if (notBlank(req.firstName())) updates.put("firstName", req.firstName().trim());
        if (notBlank(req.lastName())) updates.put("lastName", req.lastName().trim());

        boolean praticien = "PRATICIEN".equals(user.getType());
        if (!praticien && (req.specialite() != null || req.rpps() != null))
            throw new ValidationException("specialite et rpps ne concernent que les praticiens");
        if (praticien && (req.dateNaissance() != null || req.nss() != null))
            throw new ValidationException("dateNaissance et nss ne concernent que les patients");
        if (req.statut() != null && !req.statut().equals(user.getStatut()))
            throw new ValidationException("Le statut se modifie via PATCH /praticiens/me/statut");

        if (praticien) {
            if (notBlank(req.specialite()))
                updates.put("specialite", parseEnum(Specialite.class, req.specialite(), "specialite").name());
            if (notBlank(req.rpps())) updates.put("rpps", req.rpps().trim());
        } else {
            if (notBlank(req.dateNaissance())) updates.put("dateNaissance", validateDateNaissance(req.dateNaissance()));
            if (notBlank(req.nss())) updates.put("nss", req.nss().trim());
        }
        String first = (String) updates.getOrDefault("firstName", user.getFirstName());
        String last = (String) updates.getOrDefault("lastName", user.getLastName());
        updates.put("name", first + " " + last);

        User updated = userRepository.update(userId, updates);
        log.info("{\"event\":\"PROFILE_UPDATED\",\"userId\":\"{}\",\"fields\":\"{}\"}", userId, updates.keySet());
        return UserResponse.from(updated);
    }

    // ========== Médecin traitant ==========

    public UserResponse setMedecinTraitant(String patientId, String medecinTraitantId) {
        User patient = findUser(patientId);
        if (!"PATIENT".equals(patient.getType()))
            throw new ForbiddenException("Seul un patient peut désigner son médecin traitant");
        User medecin = userRepository.findById(medecinTraitantId)
            .filter(u -> "PRATICIEN".equals(u.getType()))
            .orElseThrow(() -> new NotFoundException("Praticien " + medecinTraitantId + " non trouvé"));

        if (!Specialite.GENERALISTE.name().equals(medecin.getSpecialite()))
            throw new InvalidSpecialityException("Le médecin traitant doit être GENERALISTE (spécialité actuelle : "
                + medecin.getSpecialite() + ")");
        // Le sujet ne bloque que le statut INACTIF : un médecin en congé reste désignable.
        if (PraticienStatut.INACTIF.name().equals(medecin.getStatut()))
            throw new PractitionerNotAvailableException("Le praticien est INACTIF et ne peut pas être désigné médecin traitant");

        User updated = userRepository.update(patientId, Map.of("medecinTraitantId", medecinTraitantId));
        log.info("{\"event\":\"MEDECIN_TRAITANT_SET\",\"patientId\":\"{}\",\"praticienId\":\"{}\"}", patientId, medecinTraitantId);
        return UserResponse.from(updated);
    }

    // ========== Statut praticien ==========

    public UserResponse updatePraticienStatut(String praticienId, String statut) {
        User praticien = findUser(praticienId);
        if (!"PRATICIEN".equals(praticien.getType()))
            throw new ForbiddenException("Seul un praticien peut modifier son statut");
        PraticienStatut nouveau = parseEnum(PraticienStatut.class, statut, "statut");
        User updated = userRepository.update(praticienId, Map.of("statut", nouveau.name()));
        log.info("{\"event\":\"PRATICIEN_STATUT_CHANGED\",\"praticienId\":\"{}\",\"from\":\"{}\",\"to\":\"{}\"}",
            praticienId, praticien.getStatut(), nouveau);
        return UserResponse.from(updated);
    }

    // ========== Recherche de praticiens ==========

    public PagedResponse<UserResponse> listPraticiens(String specialite, String statut, int page, int limit) {
        validatePagination(page, limit);
        String spe = notBlank(specialite) ? parseEnum(Specialite.class, specialite, "specialite").name() : null;
        String sta = notBlank(statut) ? parseEnum(PraticienStatut.class, statut, "statut").name() : null;
        List<UserResponse> all = userRepository.findPraticiens(spe, sta).stream()
            .sorted(Comparator.comparing(User::getLastName, Comparator.nullsLast(String::compareToIgnoreCase)))
            .map(UserResponse::from)
            .toList();
        int from = Math.min((page - 1) * limit, all.size());
        int to = Math.min(from + limit, all.size());
        return new PagedResponse<>(all.subList(from, to), all.size(), page, limit);
    }

    // ========== Utilitaires ==========

    private User findUser(String id) {
        return userRepository.findById(id).orElseThrow(() -> new NotFoundException("Utilisateur " + id + " non trouvé"));
    }

    static void validatePagination(int page, int limit) {
        if (page < 1) throw new ValidationException("page doit être >= 1");
        if (limit < 1 || limit > MAX_LIMIT) throw new ValidationException("limit doit être compris entre 1 et " + MAX_LIMIT);
    }

    private String validateDateNaissance(String value) {
        try {
            LocalDate d = LocalDate.parse(value.trim());
            if (d.isAfter(LocalDate.now(clock))) throw new ValidationException("dateNaissance ne peut pas être dans le futur");
            return d.toString();
        } catch (DateTimeParseException e) {
            throw new ValidationException("dateNaissance doit être au format YYYY-MM-DD");
        }
    }

    private static String required(String value, String field) {
        if (!notBlank(value)) throw new ValidationException(field + " est requis");
        return value.trim();
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    static <E extends Enum<E>> E parseEnum(Class<E> type, String value, String field) {
        try {
            return Enum.valueOf(type, value.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException e) {
            throw new ValidationException(field + " invalide (valeurs possibles : " + Arrays.toString(type.getEnumConstants()) + ")");
        }
    }
}
