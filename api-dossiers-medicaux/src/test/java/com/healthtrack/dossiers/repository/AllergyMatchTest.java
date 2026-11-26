package com.healthtrack.dossiers.repository;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AllergyMatchTest {
    @Test
    void correspondance() {
        assertThat(PrescriptionLookupRepository.allergyMatches("Amoxicilline", "Augmentin", "Amoxicilline + acide clavulanique")).isTrue();
        assertThat(PrescriptionLookupRepository.allergyMatches("ibuprofène", "Ibuprofene 400 mg", "Ibuprofene")).isTrue();
        assertThat(PrescriptionLookupRepository.allergyMatches("Amoxicilline", "Doliprane", "Paracetamol")).isFalse();
    }
}
