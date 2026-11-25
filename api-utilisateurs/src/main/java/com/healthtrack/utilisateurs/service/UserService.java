package com.healthtrack.utilisateurs.service;

import com.healthtrack.utilisateurs.config.JwtService;
import com.healthtrack.utilisateurs.dto.*;
import com.healthtrack.utilisateurs.exception.ApiException;
import com.healthtrack.utilisateurs.model.*;
import com.healthtrack.utilisateurs.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse register(RegisterRequest req) {
        String type = req.type().toUpperCase();
        if (!type.equals("PRATICIEN") && !type.equals("PATIENT"))
            throw new ApiException("ValidationError", "type doit être PRATICIEN ou PATIENT", 400);

        if (type.equals("PRATICIEN")) {
            if (req.specialite() == null || req.specialite().isBlank())
                throw new ApiException("ValidationError", "specialite est requis pour un praticien", 400);
            if (req.rpps() == null || req.rpps().isBlank())
                throw new ApiException("ValidationError", "rpps est requis pour un praticien", 400);
        }
        if (type.equals("PATIENT")) {
            if (req.dateNaissance() == null || req.dateNaissance().isBlank())
                throw new ApiException("ValidationError", "dateNaissance est requis pour un patient", 400);
            if (req.nss() == null || req.nss().isBlank())
                throw new ApiException("ValidationError", "nss est requis pour un patient", 400);
        }

        if (userRepository.existsByEmail(req.email()))
            throw new ApiException("EmailAlreadyUsedException", "Un utilisateur avec cet email existe déjà", 409);

        String now = Instant.now().toString();
        User user = new User();
        user.setUserId(UUID.randomUUID().toString());
        user.setEmail(req.email());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setType(type);
        user.setFirstName(req.firstName());
        user.setLastName(req.lastName());
        user.setName(req.firstName() + " " + req.lastName());
        user.setCreatedAt(now);
        user.setUpdatedAt(now);

        if (type.equals("PRATICIEN")) {
            user.setSpecialite(req.specialite());
            user.setRpps(req.rpps());
            user.setStatut("ACTIF");
        } else {
            user.setDateNaissance(req.dateNaissance());
            user.setNss(req.nss());
        }

        User saved = userRepository.save(user);
        String token = jwtService.generateToken(saved.getUserId(), saved.getEmail(), saved.getType(), saved.getName());
        return new AuthResponse(UserResponse.from(saved), token);
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.email())
            .orElseThrow(() -> new ApiException("InvalidCredentials", "Email ou mot de passe incorrect", 401));
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash()))
            throw new ApiException("InvalidCredentials", "Email ou mot de passe incorrect", 401);
        String token = jwtService.generateToken(user.getUserId(), user.getEmail(), user.getType(), user.getName());
        return new AuthResponse(UserResponse.from(user), token);
    }

    public UserResponse getProfile(String userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException("NotFound", "Utilisateur non trouvé", 404));
        return UserResponse.from(user);
    }

    public UserResponse updateProfile(String userId, UpdateProfileRequest req) {
        if (!userRepository.findById(userId).isPresent())
            throw new ApiException("NotFound", "Utilisateur non trouvé", 404);
        Map<String, Object> updates = new HashMap<>();
        if (req.firstName() != null) updates.put("firstName", req.firstName());
        if (req.lastName() != null) updates.put("lastName", req.lastName());
        if (req.name() != null) updates.put("name", req.name());
        if (req.dateNaissance() != null) updates.put("dateNaissance", req.dateNaissance());
        if (req.nss() != null) updates.put("nss", req.nss());
        if (req.specialite() != null) updates.put("specialite", req.specialite());
        if (req.rpps() != null) updates.put("rpps", req.rpps());
        if (req.statut() != null) updates.put("statut", req.statut());
        User updated = userRepository.update(userId, updates);
        return UserResponse.from(updated);
    }

    public UserResponse setMedecinTraitant(String patientId, String medecinTraitantId) {
        User patient = userRepository.findById(patientId)
            .orElseThrow(() -> new ApiException("NotFound", "Patient non trouvé", 404));
        if (!"PATIENT".equals(patient.getType()))
            throw new ApiException("Forbidden", "Seul un patient peut désigner son médecin traitant", 403);
        User medecin = userRepository.findById(medecinTraitantId)
            .orElseThrow(() -> new ApiException("NotFound", "Praticien non trouvé", 404));
        if (!"PRATICIEN".equals(medecin.getType()))
            throw new ApiException("NotFound", "Praticien non trouvé", 404);
        String specialite = Normalizer.normalize(
                medecin.getSpecialite() == null ? "" : medecin.getSpecialite(), Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .trim()
            .toLowerCase(Locale.ROOT);
        if (!"medecine generale".equals(specialite))
            throw new ApiException("InvalidSpecialityException", "Le médecin traitant doit être généraliste", 409);
        if (!"ACTIF".equals(medecin.getStatut()))
            throw new ApiException("PractitionerNotAvailableException", "Le praticien n'est pas disponible", 409);
        User updated = userRepository.update(patientId, Map.of("medecinTraitantId", medecinTraitantId));
        return UserResponse.from(updated);
    }

    public UserResponse updatePraticienStatut(String praticienId, String statut) {
        User praticien = userRepository.findById(praticienId)
            .orElseThrow(() -> new ApiException("NotFound", "Praticien non trouvé", 404));
        if (!"PRATICIEN".equals(praticien.getType()))
            throw new ApiException("Forbidden", "Seul un praticien peut modifier son statut", 403);
        if (!statut.matches("ACTIF|EN_CONGE|INACTIF"))
            throw new ApiException("ValidationError", "statut invalide", 400);
        User updated = userRepository.update(praticienId, Map.of("statut", statut));
        return UserResponse.from(updated);
    }

    public PagedResponse<UserResponse> listPraticiens(String specialite, String statut, int page, int limit) {
        List<User> praticiens = userRepository.listPraticiens(specialite, statut, page, limit);
        List<UserResponse> items = praticiens.stream().map(UserResponse::from).toList();
        return new PagedResponse<>(items, items.size(), page, limit);
    }
}
