package com.healthtrack.ordonnances.config;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
@Configuration @EnableWebSecurity
public class SecurityConfig {
    private final JwtAuthFilter f;
    public SecurityConfig(JwtAuthFilter f) { this.f = f; }
    @Bean public SecurityFilterChain fc(HttpSecurity h) throws Exception {
        h.csrf(AbstractHttpConfigurer::disable).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
         .authorizeHttpRequests(a -> a.requestMatchers("/swagger-ui/**","/v3/api-docs/**","/h2-console/**").permitAll().anyRequest().authenticated())
         .addFilterBefore(f, UsernamePasswordAuthenticationFilter.class).headers(x -> x.frameOptions(y -> y.disable()));
        return h.build();
    }
}
