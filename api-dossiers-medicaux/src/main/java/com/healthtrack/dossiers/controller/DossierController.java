package com.healthtrack.dossiers.controller;

import com.healthtrack.dossiers.dto.*;
import com.healthtrack.dossiers.exception.UnauthorizedException;
import com.healthtrack.dossiers.model.*;
import com.healthtrack.dossiers.service.DossierService;
import com.healthtrack.dossiers.service.DossierService.Caller;
import io.jsonwebtoken.Claims;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

/**
 * Routes de l'API Dossiers Médicaux (le dossier d'un patient est identifié par l'id du patient).
 * <pre>
 * GET    /patients/{id}/dossier          dossier complet (antécédents, allergies, vaccinations)
 * PATCH  /patients/{id}/dossier          modifier le groupe sanguin
 * GET    /patients/{id}/antecedents      lister les antécédents (filtre statut)
 * POST   /patients/{id}/antecedents      ajouter un antécédent
 * PATCH  /antecedents/{id}               modifier / archiver (statut=ARCHIVE) un antécédent
 * GET    /patients/{id}/allergies        lister les allergies (utile lors de la prescription)
 * POST   /patients/{id}/allergies        ajouter une allergie
 * PATCH  /allergies/{id}                 modifier une allergie (tracé dans CloudWatch)
 * DELETE /allergies/{id}                 supprimer une allergie
 * GET    /patients/{id}/vaccinations     lister les vaccinations
 * POST   /patients/{id}/vaccinations     ajouter une vaccination
 * </pre>
 */
@RestController
public class DossierController {

    private final DossierService service;

    public DossierController(DossierService service) {
        this.service = service;
    }

    private Caller caller() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || a.getPrincipal() == null || "anonymousUser".equals(a.getPrincipal())) throw new UnauthorizedException();
        String type = null, name = null;
        if (a.getDetails() instanceof Claims c) {
            type = c.get("type", String.class);
            name = c.get("name", String.class);
        }
        return new Caller(a.getPrincipal().toString(), type, name);
    }

    // ---------- Dossier ----------

    @GetMapping("/patients/{id}/dossier")
    public DossierComplet getDossier(@PathVariable String id) {
        return service.getDossierComplet(id, caller());
    }

    @PatchMapping("/patients/{id}/dossier")
    public DossierMedical updateDossier(@PathVariable String id, @RequestBody DossierUpdate req) {
        return service.updateDossier(id, req, caller());
    }

    // ---------- Antécédents ----------

    @GetMapping("/patients/{id}/antecedents")
    public List<Antecedent> listAntecedents(@PathVariable String id, @RequestParam(required = false) String statut) {
        return service.listAntecedents(id, statut, caller());
    }

    @PostMapping("/patients/{id}/antecedents")
    public ResponseEntity<Antecedent> createAntecedent(@PathVariable String id, @Valid @RequestBody AntecedentRequest req) {
        Antecedent a = service.createAntecedent(id, req, caller());
        return ResponseEntity.created(URI.create("/antecedents/" + a.getAntecedentId())).body(a);
    }

    @PatchMapping("/antecedents/{id}")
    public Antecedent updateAntecedent(@PathVariable String id, @RequestBody AntecedentUpdate req) {
        return service.updateAntecedent(id, req, caller());
    }

    // ---------- Allergies ----------

    @GetMapping("/patients/{id}/allergies")
    public List<Allergie> listAllergies(@PathVariable String id) {
        return service.listAllergies(id, caller());
    }

    @PostMapping("/patients/{id}/allergies")
    public ResponseEntity<Allergie> createAllergie(@PathVariable String id, @Valid @RequestBody AllergieRequest req) {
        Allergie a = service.createAllergie(id, req, caller());
        return ResponseEntity.created(URI.create("/allergies/" + a.getAllergieId())).body(a);
    }

    @PatchMapping("/allergies/{id}")
    public Allergie updateAllergie(@PathVariable String id, @RequestBody AllergieUpdate req) {
        return service.updateAllergie(id, req, caller());
    }

    @DeleteMapping("/allergies/{id}")
    public ResponseEntity<Void> deleteAllergie(@PathVariable String id) {
        service.deleteAllergie(id, caller());
        return ResponseEntity.noContent().build();
    }

    // ---------- Vaccinations ----------

    @GetMapping("/patients/{id}/vaccinations")
    public List<Vaccination> listVaccinations(@PathVariable String id) {
        return service.listVaccinations(id, caller());
    }

    @PostMapping("/patients/{id}/vaccinations")
    public ResponseEntity<Vaccination> createVaccination(@PathVariable String id, @Valid @RequestBody VaccinationRequest req) {
        Vaccination v = service.createVaccination(id, req, caller());
        return ResponseEntity.created(URI.create("/patients/" + id + "/vaccinations/" + v.getVaccinationId())).body(v);
    }
}
