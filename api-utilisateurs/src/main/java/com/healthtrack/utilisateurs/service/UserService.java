package com.healthtrack.utilisateurs.service;

import com.healthtrack.utilisateurs.config.JwtService;
import com.healthtrack.utilisateurs.dto.*;
import com.healthtrack.utilisateurs.exception.ApiException;
import com.healthtrack.utilisateurs.model.*;
import com.healthtrack.utilisateurs.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional
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
        UserType type;
        try {
            type = req.getUserType();
        } catch (IllegalArgumentException e) {
            throw new ApiException("ValidationError", "type doit être PRATICIEN ou PATIENT", 400);
        }

        if (type == UserType.PRATICIEN) {
            if (req.specialite() == null || req.specialite().isBlank())
                throw new ApiException("ValidationError", "specialite est requis pour un praticien", 400);
            if (req.rpps() == null || req.rpps().isBlank())
                throw new ApiException("ValidationError", "rpps est requis pour un praticien", 400);
        }
        if (type == UserType.PATIENT) {
            if (req.dateNaissance() == null || req.dateNaissance().isBlank())
                throw new ApiException("ValidationError", "dateNaissance est requis pour un patient", 400);
            if (req.nss() == null || req.nss().isBlank())
                throw new ApiException("ValidationError", "nss est requis pour un patient", 400);
        }

        if (userRepository.existsByEmail(req.email()))
            throw new ApiException("EmailAlreadyUsedException", "Un utilisateur avec cet email existe déjà", 409);

        User user = new User();
        user.setUserId(UUID.randomUUID().toString());
        user.setEmail(req.email());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setType(type);
        user.setFirstName(req.firstName());
        user.setLastName(req.lastName());
        user.setName(req.firstName() + " " + req.lastName());

        if (type == UserType.PRATICIEN) {
            user.setSpecialite(req.specialite());
            user.setRpps(req.rpps());
            user.setStatut(PraticienStatut.ACTIF);
        } else {
            user.setDateNaissance(req.dateNaissance());
            user.setNss(req.nss());
        }

        User saved = userRepository.save(user);
        String token = jwtService.generateToken(saved.getUserId(), saved.getEmail(), saved.getType().name(), saved.getName());
        return new AuthResponse(UserResponse.from(saved), token);
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.email())
            .orElseThrow(() -> new ApiException("InvalidCredentials", "Email ou mot de passe incorrect", 401));
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash()))
            throw new ApiException("InvalidCredentials", "Email ou mot de passe incorrect", 401);
        String token = jwtService.generateToken(user.getUserId(), user.getEmail(), user.getType().name(), user.getName());
        return new AuthResponse(UserResponse.from(user), token);
    }

    @Transactional(readOnly = true)
    public UserResponse getProfile(String userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException("NotFound", "Utilisateur non trouvé", 404));
        return UserResponse.from(user);
    }

    public UserResponse updateProfile(String userId, UpdateProfileRequest req) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException("NotFound", "Utilisateur non trouvé", 404));
        if (req.firstName() != null) user.setFirstName(req.firstName());
        if (req.lastName() != null) user.setLastName(req.lastName());
        if (req.name() != null) user.setName(req.name());
        if (req.dateNaissance() != null) user.setDateNaissance(req.dateNaissance());
        if (req.nss() != null) user.setNss(req.nss());
        if (req.specialite() != null) user.setSpecialite(req.specialite());
        if (req.rpps() != null) user.setRpps(req.rpps());
        if (req.statut() != null && user.getType() == UserType.PRATICIEN) {
            user.setStatut(PraticienStatut.valueOf(req.statut()));
        }
        return UserResponse.from(userRepository.save(user));
    }

    public UserResponse setMedecinTraitant(String patientId, String medecinTraitantId) {
        User patient = userRepository.findById(patientId)
            .orElseThrow(() -> new ApiException("NotFound", "Patient non trouvé", 404));
        if (patient.getType() != UserType.PATIENT)
            throw new ApiException("Forbidden", "Seul un patient peut désigner son médecin traitant", 403);
        User medecin = userRepository.findById(medecinTraitantId)
            .orElseThrow(() -> new ApiException("NotFound", "Praticien non trouvé", 404));
        if (medecin.getType() != UserType.PRATICIEN)
            throw new ApiException("NotFound", "Praticien non trouvé", 404);
        if (medecin.getStatut() != PraticienStatut.ACTIF)
            throw new ApiException("PractitionerNotAvailableException", "Le praticien n'est pas disponible", 409);
        patient.setMedecinTraitantId(medecinTraitantId);
        return UserResponse.from(userRepository.save(patient));
    }

    public UserResponse updatePraticienStatut(String praticienId, String statut) {
        User praticien = userRepository.findById(praticienId)
            .orElseThrow(() -> new ApiException("NotFound", "Praticien non trouvé", 404));
        if (praticien.getType() != UserType.PRATICIEN)
            throw new ApiException("Forbidden", "Seul un praticien peut modifier son statut", 403);
        try {
            praticien.setStatut(PraticienStatut.valueOf(statut));
        } catch (IllegalArgumentException e) {
            throw new ApiException("ValidationError", "statut doit être ACTIF, EN_CONGE ou INACTIF", 400);
        }
        return UserResponse.from(userRepository.save(praticien));
    }

    @Transactional(readOnly = true)
    public PagedResponse<UserResponse> listPraticiens(String specialite, String statut, int page, int limit) {
        PageRequest pr = PageRequest.of(page - 1, limit);
        Page<User> result;
        if (specialite != null && statut != null) {
            result = userRepository.findByTypeAndSpecialiteContainingIgnoreCaseAndStatut(
                UserType.PRATICIEN, specialite, PraticienStatut.valueOf(statut), pr);
        } else if (specialite != null) {
            result = userRepository.findByTypeAndSpecialiteContainingIgnoreCase(UserType.PRATICIEN, specialite, pr);
        } else if (statut != null) {
            result = userRepository.findByTypeAndStatut(UserType.PRATICIEN, PraticienStatut.valueOf(statut), pr);
        } else {
            result = userRepository.findByType(UserType.PRATICIEN, pr);
        }
        return new PagedResponse<>(
            result.getContent().stream().map(UserResponse::from).toList(),
            result.getTotalElements(), page, limit);
    }
}
