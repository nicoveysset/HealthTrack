package com.healthtrack.ordonnances.config;
import io.jsonwebtoken.Claims;
import jakarta.servlet.*; import jakarta.servlet.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component; import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException; import java.util.List;
@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService js;
    public JwtAuthFilter(JwtService js) { this.js = js; }
    @Override protected void doFilterInternal(HttpServletRequest r, HttpServletResponse rs, FilterChain c) throws ServletException, IOException {
        String h = r.getHeader("Authorization");
        if (h != null && h.startsWith("Bearer ")) {
            try { Claims cl = js.parse(h.substring(7));
                var a = new UsernamePasswordAuthenticationToken(cl.getSubject(), null, List.of(new SimpleGrantedAuthority("ROLE_"+cl.get("type",String.class))));
                a.setDetails(cl); SecurityContextHolder.getContext().setAuthentication(a);
            } catch (Exception ignored) {}
        }
        c.doFilter(r, rs);
    }
}
