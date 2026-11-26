package com.healthtrack.ordonnances.monitoring;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Alertes métier CloudWatch.
 * <p>
 * Chaque alerte produit deux sorties sur stdout (donc dans le log group de la Lambda) :
 * <ol>
 *   <li>un log WARN structuré (lisible, filtrable dans CloudWatch Logs Insights) ;</li>
 *   <li>une ligne au format CloudWatch Embedded Metric Format (EMF) : Lambda la convertit
 *       automatiquement en métrique {@code HealthTrack/Ordonnances} — aucune permission IAM supplémentaire —
 *       sur laquelle une alarme CloudWatch peut être posée (voir infrastructure/deploy-monitoring.sh).</li>
 * </ol>
 */
@Component
public class BusinessAlerts {

    public static final String NAMESPACE = "HealthTrack/Ordonnances";
    private static final Logger log = LoggerFactory.getLogger(BusinessAlerts.class);

    public void longPrescription(String ordonnanceId, String ligneId, String praticienId, String patientId, String medicament, int duree) {
        log.warn("{\"event\":\"ALERTE_PRESCRIPTION_LONGUE_DUREE\",\"ordonnanceId\":\"{}\",\"ligneId\":\"{}\",\"praticienId\":\"{}\",\"patientId\":\"{}\",\"medicament\":\"{}\",\"dureeJours\":{},\"seuilJours\":90}",
            ordonnanceId, ligneId, praticienId, patientId, escape(medicament), duree);
        emitMetric("PrescriptionLongueDuree", ordonnanceId, praticienId, duree);
    }

    public void allergyConflict(String ordonnanceId, String praticienId, String patientId, String medicament, String substance) {
        log.warn("{\"event\":\"ALLERGY_CONFLICT\",\"ordonnanceId\":\"{}\",\"praticienId\":\"{}\",\"patientId\":\"{}\",\"medicament\":\"{}\",\"substanceActive\":\"{}\"}",
            ordonnanceId, praticienId, patientId, escape(medicament), escape(substance));
        emitMetric("AllergyConflict", ordonnanceId, praticienId, 1);
    }

    private void emitMetric(String metric, String ordonnanceId, String praticienId, int valeur) {
        String emf = "{\"_aws\":{\"Timestamp\":" + Instant.now().toEpochMilli()
            + ",\"CloudWatchMetrics\":[{\"Namespace\":\"" + NAMESPACE + "\",\"Dimensions\":[[\"Service\"]],"
            + "\"Metrics\":[{\"Name\":\"" + metric + "\",\"Unit\":\"Count\"}]}]},"
            + "\"Service\":\"api-ordonnances\",\"" + metric + "\":1,"
            + "\"ordonnanceId\":\"" + ordonnanceId + "\",\"praticienId\":\"" + praticienId + "\",\"valeur\":" + valeur + "}";
        System.out.println(emf);
    }

    private static String escape(String s) {
        return s == null ? "" : s.replace("\"", "'");
    }
}
