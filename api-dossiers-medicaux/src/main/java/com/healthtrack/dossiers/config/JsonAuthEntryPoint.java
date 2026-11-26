package com.healthtrack.dossiers.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;

/** Requête sans token (ou token invalide) : 401 JSON au lieu du 403 vide par défaut de Spring Security. */
@Component
public class JsonAuthEntryPoint implements AuthenticationEntryPoint {
    @Override
    public void commence(HttpServletRequest req, HttpServletResponse res, AuthenticationException ex) throws IOException {
        res.setStatus(401);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("{\"error\":\"UnauthorizedException\",\"message\":\"Token JWT manquant ou invalide\",\"statusCode\":401,\"path\":\""
            + req.getRequestURI() + "\",\"timestamp\":\"" + Instant.now() + "\"}");
    }
}
