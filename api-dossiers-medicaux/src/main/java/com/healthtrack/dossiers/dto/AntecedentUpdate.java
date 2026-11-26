package com.healthtrack.dossiers.dto;

/** Modification partielle d'un antécédent. statut=ARCHIVE archive l'antécédent (interdit pour un CHRONIQUE). */
public record AntecedentUpdate(String libelle, String type, String date, String description, String statut) {}
