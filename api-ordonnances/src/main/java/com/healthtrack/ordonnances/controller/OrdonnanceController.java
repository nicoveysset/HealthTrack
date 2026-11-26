package com.healthtrack.ordonnances.controller;

import com.healthtrack.ordonnances.dto.*;
import com.healthtrack.ordonnances.exception.UnauthorizedException;
import com.healthtrack.ordonnances.model.*;
import com.healthtrack.ordonnances.service.OrdonnanceService;
import com.healthtrack.ordonnances.service.OrdonnanceService.Caller;
import io.jsonwebtoken.Claims;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

/**
 * Routes de l'API Ordonnances.
 * <pre>
 * POST   /ordonnances                              créer une ordonnance sur un rendez-vous TERMINE
 * GET    /ordonnances?patientId&rdvId&statut&page&limit  lister (paginé, filtré)
 * GET    /ordonnances/{id}                         ordonnance + lignes
 * GET    /ordonnances/{id}/lignes                  lignes de prescription
 * POST   /ordonnances/{id}/lignes                  ajouter une ligne
 * DELETE /ordonnances/{id}/lignes/{ligneId}        retirer une ligne
 * GET    /medicaments?forme&search&page&limit      médicaments disponibles
 * POST   /medicaments                              ajouter un médicament au référentiel
 * </pre>
 */
@RestController
public class OrdonnanceController {

    private final OrdonnanceService service;

    public OrdonnanceController(OrdonnanceService service) {
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

    @PostMapping("/ordonnances")
    public ResponseEntity<Ordonnance> create(@Valid @RequestBody OrdonnanceRequest req) {
        Ordonnance o = service.createOrdonnance(req.rdvId(), caller());
        return ResponseEntity.created(URI.create("/ordonnances/" + o.getOrdonnanceId())).body(o);
    }

    @GetMapping("/ordonnances")
    public PagedResponse<Ordonnance> list(@RequestParam(required = false) String patientId,
                                          @RequestParam(required = false) String rdvId,
                                          @RequestParam(required = false) String statut,
                                          @RequestParam(defaultValue = "1") int page,
                                          @RequestParam(defaultValue = "10") int limit) {
        return service.listOrdonnances(caller(), patientId, rdvId, statut, page, limit);
    }

    @GetMapping("/ordonnances/{id}")
    public OrdonnanceAvecLignes get(@PathVariable String id) {
        return service.getOrdonnance(id, caller());
    }

    @GetMapping("/ordonnances/{id}/lignes")
    public List<LignePrescription> listLignes(@PathVariable String id) {
        return service.listLignes(id, caller());
    }

    @PostMapping("/ordonnances/{id}/lignes")
    public ResponseEntity<LignePrescription> addLigne(@PathVariable String id, @Valid @RequestBody LigneRequest req) {
        LignePrescription l = service.addLigne(id, req, caller());
        return ResponseEntity.created(URI.create("/ordonnances/" + id + "/lignes/" + l.getLigneId())).body(l);
    }

    @DeleteMapping("/ordonnances/{id}/lignes/{ligneId}")
    public ResponseEntity<Void> deleteLigne(@PathVariable String id, @PathVariable String ligneId) {
        service.deleteLigne(id, ligneId, caller());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/medicaments")
    public PagedResponse<Medicament> listMedicaments(@RequestParam(required = false) String forme,
                                                     @RequestParam(required = false) String search,
                                                     @RequestParam(defaultValue = "1") int page,
                                                     @RequestParam(defaultValue = "20") int limit) {
        return service.listMedicaments(forme, search, page, limit);
    }

    @PostMapping("/medicaments")
    public ResponseEntity<Medicament> createMedicament(@Valid @RequestBody MedicamentRequest req) {
        Medicament m = service.createMedicament(req, caller());
        return ResponseEntity.created(URI.create("/medicaments/" + m.getMedicamentId())).body(m);
    }
}
