package com.healthtrack.utilisateurs.controller;

import com.healthtrack.utilisateurs.dto.*;
import com.healthtrack.utilisateurs.exception.ApiException;
import com.healthtrack.utilisateurs.service.UserService;
import io.jsonwebtoken.Claims;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null || auth.getPrincipal().equals("anonymousUser"))
            throw new ApiException("Unauthorized", "Non autorisé", 401);
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
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.register(req));
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

    @PutMapping("/patients/me/medecin-traitant")
    public UserResponse setMedecinTraitant(@Valid @RequestBody MedecinTraitantRequest req) {
        if (!"PATIENT".equals(currentUserType()))
            throw new ApiException("Forbidden", "Seul un patient peut désigner son médecin traitant", 403);
        return userService.setMedecinTraitant(currentUserId(), req.medecinTraitantId());
    }

    @PatchMapping("/praticiens/me/statut")
    public UserResponse updateStatut(@Valid @RequestBody StatutRequest req) {
        if (!"PRATICIEN".equals(currentUserType()))
            throw new ApiException("Forbidden", "Seul un praticien peut modifier son statut", 403);
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
