package com.healthtrack.rdv.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

/**
 * Lambda tourne en UTC : on fixe explicitement le fuseau du cabinet (Europe/Paris)
 * pour que "maintenant" corresponde à l'heure saisie par les utilisateurs.
 * Injecté dans les services, ce Clock est aussi remplaçable dans les tests.
 */
@Configuration
public class TimeConfig {
    public static final ZoneId CABINET_ZONE = ZoneId.of("Europe/Paris");

    @Bean
    public Clock clock() {
        return Clock.system(CABINET_ZONE);
    }
}
