package com.healthtrack.ordonnances.config;
import io.jsonwebtoken.Claims; import io.jsonwebtoken.Jwts; import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value; import org.springframework.stereotype.Service;
import javax.crypto.SecretKey; import java.nio.charset.StandardCharsets;
@Service
public class JwtService {
    private final SecretKey key;
    public JwtService(@Value("${jwt.secret}") String s) { key = Keys.hmacShaKeyFor(s.getBytes(StandardCharsets.UTF_8)); }
    public Claims parse(String t) { return Jwts.parser().verifyWith(key).build().parseSignedClaims(t).getPayload(); }
}
