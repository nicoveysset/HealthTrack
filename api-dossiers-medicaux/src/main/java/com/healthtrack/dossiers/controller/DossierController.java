package com.healthtrack.dossiers.controller;

import com.healthtrack.dossiers.dto.*;
import com.healthtrack.dossiers.exception.ApiException;
import com.healthtrack.dossiers.model.*;
import com.healthtrack.dossiers.service.DossierService;
import io.jsonwebtoken.Claims;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class DossierController {
    private final DossierService service;
    public DossierController(DossierService service) { this.service = service; }

    private String uid() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || "anonymousUser".equals(a.getPrincipal())) throw new ApiException("Unauthorized", "Non autorisé", 401);
        return a.getPrincipal().toString();
    }
    private String utype() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a != null && a.getDetails() instanceof Claims c) return c.get("type", String.class);
        return null;
    }

    @GetMapping("/patients/{id}/dossier")
    public DossierComplet getDossier(@PathVariable String id) { return service.getDossierComplet(id, uid(), utype()); }

    @PostMapping("/dossiers/{id}/antecedents")
    public ResponseEntity<Antecedent> createAntecedent(@PathVariable String id, @Valid @RequestBody AntecedentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createAntecedent(id, req, uid(), utype()));
    }
    @PatchMapping("/antecedents/{id}")
    public Antecedent updateAntecedent(@PathVariable String id, @RequestBody AntecedentUpdate req) {
        return service.updateAntecedent(id, req, uid(), utype());
    }
    @PostMapping("/antecedents/{id}/archiver")
    public Antecedent archive(@PathVariable String id) { return service.archiveAntecedent(id, uid(), utype()); }
    @GetMapping("/patients/{id}/antecedents")
    public List<Antecedent> listAntecedents(@PathVariable String id) { return service.listAntecedents(id, uid(), utype()); }

    @PostMapping("/dossiers/{id}/allergies")
    public ResponseEntity<Allergie> createAllergie(@PathVariable String id, @Valid @RequestBody AllergieRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createAllergie(id, req, uid(), utype()));
    }
    @DeleteMapping("/allergies/{id}")
    public ResponseEntity<Void> deleteAllergie(@PathVariable String id) {
        service.deleteAllergie(id, uid(), utype());
        return ResponseEntity.noContent().build();
    }
    @GetMapping("/patients/{id}/allergies")
    public List<Allergie> listAllergies(@PathVariable String id) { return service.listAllergies(id, uid(), utype()); }

    @PostMapping("/dossiers/{id}/vaccinations")
    public ResponseEntity<Vaccination> createVaccination(@PathVariable String id, @Valid @RequestBody VaccinationRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createVaccination(id, req, uid(), utype()));
    }
    @GetMapping("/patients/{id}/vaccinations")
    public List<Vaccination> listVaccinations(@PathVariable String id) { return service.listVaccinations(id, uid(), utype()); }
}
