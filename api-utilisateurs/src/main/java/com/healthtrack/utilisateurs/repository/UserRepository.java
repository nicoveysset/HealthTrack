package com.healthtrack.utilisateurs.repository;

import com.healthtrack.utilisateurs.model.User;
import com.healthtrack.utilisateurs.model.UserType;
import com.healthtrack.utilisateurs.model.PraticienStatut;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    Page<User> findByTypeAndSpecialiteContainingIgnoreCaseAndStatut(
            UserType type, String specialite, PraticienStatut statut, Pageable pageable);
    Page<User> findByType(UserType type, Pageable pageable);
    Page<User> findByTypeAndSpecialiteContainingIgnoreCase(
            UserType type, String specialite, Pageable pageable);
    Page<User> findByTypeAndStatut(UserType type, PraticienStatut statut, Pageable pageable);
}
