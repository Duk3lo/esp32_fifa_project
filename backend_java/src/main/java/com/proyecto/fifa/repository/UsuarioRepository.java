package com.proyecto.fifa.repository;

import com.proyecto.fifa.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {
    Usuario findByCodigo(Integer codigo);
}