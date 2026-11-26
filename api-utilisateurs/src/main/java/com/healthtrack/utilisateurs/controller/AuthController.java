package com.healthtrack.utilisateurs.controller;

import com.healthtrack.utilisateurs.dto.*;
import com.healthtrack.utilisateurs.exception.ForbiddenException;
import com.healthtrack.utilisateurs.exception.UnauthorizedException;
import com.healthtrack.utilisateurs.service.UserService;
import io.jsonwebtoken.Claims;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

/**
 * Routes de l'API Utilisateurs.
 * <pre>
 * POST  /auth/register                 inscription (patient ou praticien)
 * POST  /auth/login                    connexion → JWT
 * GET   /utilisateurs/me               mon profil
 * PATCH /utilisateurs/me               modifier mon profil
 * GET   /utilisateurs/{id}             profil d'un utilisateur
 * PUT   /patients/me/medecin-traitant  désigner / modifier mon médecin traitant
 * PATCH /praticiens/me/statut          passer en ACTIF / EN_CONGE / INACTIF
 * GET   /praticiens                    recherche paginée (filtres specialite, statut)
 * </pre>
 */
@RestController
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null || "anonymousUser".equals(auth.getPrincipal()))
            throw new UnauthorizedException();
        return auth.getPrincipal().toString();
    }

    private String currentUserType() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getDetails() instanceof Claims claims)
            return claims.get("type", String.class);
        return null;
    }

    @PostMapping("/auth/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        AuthResponse res = userService.register(req);
        return ResponseEntity.created(URI.create("/utilisateurs/" + res.user().userId())).body(res);
    }

    @PostMapping("/auth/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return userService.login(req);
    }

    @GetMapping("/utilisateurs/me")
    public UserResponse getMe() {
        return userService.getProfile(currentUserId());
    }

    @PatchMapping("/utilisateurs/me")
    public UserResponse updateMe(@RequestBody UpdateProfileRequest req) {
        return userService.updateProfile(currentUserId(), req);
    }

    @GetMapping("/utilisateurs/{id}")
    public UserResponse getUser(@PathVariable String id) {
        return userService.getUser(id, currentUserId(), currentUserType());
    }

    @PutMapping("/patients/me/medecin-traitant")
    public UserResponse setMedecinTraitant(@Valid @RequestBody MedecinTraitantRequest req) {
        if (!"PATIENT".equals(currentUserType()))
            throw new ForbiddenException("Seul un patient peut désigner son médecin traitant");
        return userService.setMedecinTraitant(currentUserId(), req.medecinTraitantId());
    }

    @PatchMapping("/praticiens/me/statut")
    public UserResponse updateStatut(@Valid @RequestBody StatutRequest req) {
        if (!"PRATICIEN".equals(currentUserType()))
            throw new ForbiddenException("Seul un praticien peut modifier son statut");
        return userService.updatePraticienStatut(currentUserId(), req.statut());
    }

    @GetMapping("/praticiens")
    public PagedResponse<UserResponse> listPraticiens(
            @RequestParam(required = false) String specialite,
            @RequestParam(required = false) String statut,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        return userService.listPraticiens(specialite, statut, page, limit);
    }
}
