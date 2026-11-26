package com.healthtrack.rdv.controller;

import com.healthtrack.rdv.dto.*;
import com.healthtrack.rdv.exception.ForbiddenException;
import com.healthtrack.rdv.exception.UnauthorizedException;
import com.healthtrack.rdv.model.*;
import com.healthtrack.rdv.service.RdvService;
import io.jsonwebtoken.Claims;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

/**
 * Routes de l'API Disponibilités et Rendez-vous.
 * <pre>
 * PUT    /praticiens/me/disponibilites              définir / modifier mes disponibilités hebdomadaires
 * GET    /praticiens/me/disponibilites              mes disponibilités
 * GET    /praticiens/{id}/disponibilites            disponibilités d'un praticien
 * POST   /praticiens/me/indisponibilites            déclarer une indisponibilité ponctuelle
 * GET    /praticiens/me/indisponibilites            mes indisponibilités
 * DELETE /praticiens/me/indisponibilites/{id}       supprimer une de mes indisponibilités
 * GET    /praticiens/{id}/creneaux?dateDebut&dateFin  créneaux libres sur une période
 * POST   /rendezvous                                prendre un rendez-vous
 * GET    /rendezvous?statut&dateDebut&dateFin&page&limit  mes rendez-vous (paginés, filtrés)
 * GET    /rendezvous/{id}                           détail d'un rendez-vous
 * PATCH  /rendezvous/{id}                           changer le statut (CONFIRME, EN_COURS, TERMINE, ANNULE, NON_VENU)
 * POST   /rendezvous/{id}/compte-rendu              rédiger le compte rendu
 * PUT    /rendezvous/{id}/compte-rendu              modifier le compte rendu (brouillon)
 * POST   /rendezvous/{id}/compte-rendu/finalisation finaliser le compte rendu
 * GET    /rendezvous/{id}/compte-rendu              consulter le compte rendu
 * </pre>
 */
@RestController
public class RdvController {

    private final RdvService service;

    public RdvController(RdvService service) {
        this.service = service;
    }

    private String uid() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || a.getPrincipal() == null || "anonymousUser".equals(a.getPrincipal())) throw new UnauthorizedException();
        return a.getPrincipal().toString();
    }

    private String claim(String name) {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a != null && a.getDetails() instanceof Claims c) return c.get(name, String.class);
        return null;
    }

    private String utype() {
        return claim("type");
    }

    private void requirePraticien() {
        if (!"PRATICIEN".equals(utype())) throw new ForbiddenException("Seul un praticien peut effectuer cette action");
    }

    // ---------- Disponibilités ----------

    @PutMapping("/praticiens/me/disponibilites")
    public List<Disponibilite> setDispos(@RequestBody DisponibilitesRequest req) {
        requirePraticien();
        return service.replaceDisponibilites(uid(), req.disponibilites());
    }

    @GetMapping("/praticiens/me/disponibilites")
    public List<Disponibilite> getMyDispos() {
        requirePraticien();
        return service.getDisponibilites(uid());
    }

    @GetMapping("/praticiens/{id}/disponibilites")
    public List<Disponibilite> getDispos(@PathVariable String id) {
        return service.getDisponibilites(id);
    }

    // ---------- Indisponibilités ----------

    @PostMapping("/praticiens/me/indisponibilites")
    public ResponseEntity<Indisponibilite> createIndispo(@Valid @RequestBody IndisponibiliteRequest req) {
        requirePraticien();
        Indisponibilite i = service.createIndisponibilite(uid(), req);
        return ResponseEntity.created(URI.create("/praticiens/me/indisponibilites/" + i.getIndispoId())).body(i);
    }

    @GetMapping("/praticiens/me/indisponibilites")
    public List<Indisponibilite> getMyIndispos() {
        requirePraticien();
        return service.getIndisponibilites(uid());
    }

    @DeleteMapping("/praticiens/me/indisponibilites/{id}")
    public ResponseEntity<Void> deleteIndispo(@PathVariable String id) {
        requirePraticien();
        service.deleteIndisponibilite(id, uid());
        return ResponseEntity.noContent().build();
    }

    // ---------- Créneaux ----------

    @GetMapping("/praticiens/{id}/creneaux")
    public List<Creneau> getCreneaux(@PathVariable String id, @RequestParam String dateDebut, @RequestParam String dateFin) {
        return service.calculateCreneaux(id, dateDebut, dateFin);
    }

    // ---------- Rendez-vous ----------

    @PostMapping("/rendezvous")
    public ResponseEntity<RendezVous> createRdv(@Valid @RequestBody RendezVousRequest req) {
        RendezVous rdv = service.createRendezVous(uid(), utype(), claim("name"), req);
        return ResponseEntity.created(URI.create("/rendezvous/" + rdv.getRdvId())).body(rdv);
    }

    @GetMapping("/rendezvous")
    public PagedResponse<RendezVous> listRdv(@RequestParam(required = false) String statut,
                                             @RequestParam(required = false) String dateDebut,
                                             @RequestParam(required = false) String dateFin,
                                             @RequestParam(defaultValue = "1") int page,
                                             @RequestParam(defaultValue = "10") int limit) {
        return service.listRendezVous(uid(), utype(), statut, dateDebut, dateFin, page, limit);
    }

    @GetMapping("/rendezvous/{id}")
    public RendezVous getRdv(@PathVariable String id) {
        return service.getRendezVous(id, uid());
    }

    @PatchMapping("/rendezvous/{id}")
    public RendezVous updateStatut(@PathVariable String id, @Valid @RequestBody StatutRdvRequest req) {
        return service.updateStatut(id, req.statut(), uid(), utype());
    }

    // ---------- Compte rendu ----------

    @PostMapping("/rendezvous/{id}/compte-rendu")
    public ResponseEntity<CompteRendu> createCR(@PathVariable String id, @Valid @RequestBody CompteRenduRequest req) {
        requirePraticien();
        CompteRendu cr = service.createCompteRendu(id, req, uid());
        return ResponseEntity.created(URI.create("/rendezvous/" + id + "/compte-rendu")).body(cr);
    }

    @PutMapping("/rendezvous/{id}/compte-rendu")
    public CompteRendu updateCR(@PathVariable String id, @Valid @RequestBody CompteRenduRequest req) {
        requirePraticien();
        return service.updateCompteRendu(id, req, uid());
    }

    @PostMapping("/rendezvous/{id}/compte-rendu/finalisation")
    public CompteRendu finaliserCR(@PathVariable String id) {
        requirePraticien();
        return service.finaliserCompteRendu(id, uid());
    }

    @GetMapping("/rendezvous/{id}/compte-rendu")
    public CompteRendu getCR(@PathVariable String id) {
        return service.getCompteRenduByRdv(id, uid());
    }
}
