package com.healthtrack.rdv.controller;

import com.healthtrack.rdv.dto.*;
import com.healthtrack.rdv.exception.ApiException;
import com.healthtrack.rdv.model.*;
import com.healthtrack.rdv.service.RdvService;
import io.jsonwebtoken.Claims;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
public class RdvController {
    private final RdvService service;
    public RdvController(RdvService service) { this.service = service; }

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

    @PutMapping("/praticiens/me/disponibilites")
    public List<Disponibilite> setDispos(@RequestBody DisponibilitesRequest req) {
        requirePraticien();
        return service.replaceDisponibilites(uid(), req.disponibilites());
    }
    @GetMapping("/praticiens/me/disponibilites")
    public List<Disponibilite> getMyDispos() { return service.getDisponibilites(uid()); }
    @GetMapping("/praticiens/{id}/disponibilites")
    public List<Disponibilite> getDispos(@PathVariable String id) { return service.getDisponibilites(id); }

    @PostMapping("/praticiens/me/indisponibilites")
    public ResponseEntity<Indisponibilite> createIndispo(@Valid @RequestBody IndisponibiliteRequest req) {
        requirePraticien();
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createIndisponibilite(uid(), req));
    }
    @GetMapping("/praticiens/me/indisponibilites")
    public List<Indisponibilite> getMyIndispos() { return service.getIndisponibilites(uid()); }
    @DeleteMapping("/indisponibilites/{id}")
    public ResponseEntity<Void> deleteIndispo(@PathVariable String id) {
        service.deleteIndisponibilite(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/praticiens/{id}/creneaux")
    public List<Creneau> getCreneaux(@PathVariable String id, @RequestParam String dateDebut, @RequestParam String dateFin) {
        return service.calculateCreneaux(id, dateDebut, dateFin);
    }

    @PostMapping("/rendezvous")
    public ResponseEntity<RendezVous> createRdv(@Valid @RequestBody RendezVousRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createRendezVous(uid(), req));
    }
    @GetMapping("/rendezvous")
    public PagedResponse<RendezVous> listRdv(@RequestParam(required = false) String statut,
                                             @RequestParam(defaultValue = "1") int page,
                                             @RequestParam(defaultValue = "10") int limit) {
        return service.listRendezVous(uid(), utype(), statut, page, limit);
    }
    @PostMapping("/rendezvous/{id}/confirmer") public RendezVous confirmer(@PathVariable String id) { return service.updateStatut(id, "CONFIRME", uid(), utype()); }
    @PostMapping("/rendezvous/{id}/annuler") public RendezVous annuler(@PathVariable String id) { return service.updateStatut(id, "ANNULE", uid(), utype()); }
    @PostMapping("/rendezvous/{id}/en-cours") public RendezVous enCours(@PathVariable String id) { return service.updateStatut(id, "EN_COURS", uid(), utype()); }
    @PostMapping("/rendezvous/{id}/termine") public RendezVous termine(@PathVariable String id) { return service.updateStatut(id, "TERMINE", uid(), utype()); }
    @PostMapping("/rendezvous/{id}/non-venu") public RendezVous nonVenu(@PathVariable String id) { return service.updateStatut(id, "NON_VENU", uid(), utype()); }

    @PostMapping("/rendezvous/{id}/compte-rendu")
    public ResponseEntity<CompteRendu> createCR(@PathVariable String id, @Valid @RequestBody CompteRenduRequest req) {
        requirePraticien();
        CompteRendu cr = service.createCompteRendu(id, req.contenu(), uid());
        return ResponseEntity.created(URI.create("/rendezvous/" + id + "/compte-rendu")).body(cr);
    }
    @GetMapping("/rendezvous/{id}/compte-rendu")
    public CompteRendu getCR(@PathVariable String id) { return service.getCompteRenduByRdv(id, uid()); }

    private void requirePraticien() {
        if (!"PRATICIEN".equals(utype()))
            throw new ApiException("Forbidden", "Seul un praticien peut effectuer cette action", 403);
    }
}
