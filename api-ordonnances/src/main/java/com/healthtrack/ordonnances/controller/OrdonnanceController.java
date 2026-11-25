package com.healthtrack.ordonnances.controller;

import com.healthtrack.ordonnances.dto.*;
import com.healthtrack.ordonnances.exception.ApiException;
import com.healthtrack.ordonnances.model.*;
import com.healthtrack.ordonnances.service.OrdonnanceService;
import io.jsonwebtoken.Claims;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class OrdonnanceController {
    private final OrdonnanceService service;
    public OrdonnanceController(OrdonnanceService service) { this.service = service; }

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

    @PostMapping("/ordonnances")
    public ResponseEntity<Ordonnance> create(@Valid @RequestBody OrdonnanceRequest req) {
        // En production: récupérer le compte rendu via API RDV pour obtenir patientId
        // Simplifié: on passe patientId via header ou body
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createOrdonnance(req.compteRenduId(), uid(), uid()));
    }
    @GetMapping("/ordonnances/{id}")
    public OrdonnanceAvecLignes get(@PathVariable String id) { return service.getOrdonnance(id, uid()); }
    @GetMapping("/ordonnances")
    public PagedResponse<Ordonnance> list(@RequestParam(required = false) String patientId,
                                          @RequestParam(defaultValue = "1") int page,
                                          @RequestParam(defaultValue = "10") int limit) {
        return service.listOrdonnances(uid(), utype(), patientId, page, limit);
    }
    @PostMapping("/ordonnances/{id}/lignes")
    public ResponseEntity<LignePrescription> addLigne(@PathVariable String id, @Valid @RequestBody LigneRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addLigne(id, req, uid()));
    }
    @DeleteMapping("/ordonnances/{id}/lignes/{ligneId}")
    public ResponseEntity<Void> deleteLigne(@PathVariable String id, @PathVariable String ligneId) {
        service.deleteLigne(id, ligneId, uid());
        return ResponseEntity.noContent().build();
    }
    @GetMapping("/ordonnances/{id}/lignes")
    public List<LignePrescription> listLignes(@PathVariable String id) { return service.listLignes(id, uid()); }
    @GetMapping("/medicaments")
    public PagedResponse<Medicament> listMedicaments(@RequestParam(required = false) String forme,
                                                     @RequestParam(required = false) String search,
                                                     @RequestParam(defaultValue = "1") int page,
                                                     @RequestParam(defaultValue = "10") int limit) {
        return service.listMedicaments(forme, search, page, limit);
    }
    @PostMapping("/medicaments")
    public ResponseEntity<Medicament> createMedicament(@Valid @RequestBody MedicamentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createMedicament(req));
    }
}
