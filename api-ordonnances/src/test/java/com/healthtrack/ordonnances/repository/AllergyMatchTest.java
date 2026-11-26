package com.healthtrack.ordonnances.repository;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AllergyMatchTest {
    @Test
    void correspondanceParNomOuSubstance() {
        assertThat(AllergieRepository.allergyMatches("Amoxicilline", "Amoxicilline 500 mg", "Amoxicilline")).isTrue();
        assertThat(AllergieRepository.allergyMatches("amoxicilline", "Augmentin", "Amoxicilline + acide clavulanique")).isTrue();
        assertThat(AllergieRepository.allergyMatches("Paracétamol", "Doliprane 1000 mg", "Paracetamol")).isTrue();
        assertThat(AllergieRepository.allergyMatches("Amoxicilline", "Doliprane 1000 mg", "Paracetamol")).isFalse();
        assertThat(AllergieRepository.allergyMatches("Aspirine", "Kardegic 75 mg", "Acide acetylsalicylique")).isFalse();
    }
}
