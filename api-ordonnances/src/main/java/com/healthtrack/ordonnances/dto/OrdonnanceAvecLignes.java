package com.healthtrack.ordonnances.dto;
import com.healthtrack.ordonnances.model.*;
import java.util.List;
public record OrdonnanceAvecLignes(Ordonnance ordonnance, List<LignePrescription> lignes) {}
