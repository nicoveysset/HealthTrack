package com.healthtrack.rdv.dto;

import java.util.List;

public record DisponibilitesRequest(List<DispoItem> disponibilites) {
    public record DispoItem(String jourSemaine, String heureDebut, String heureFin) {}
}
