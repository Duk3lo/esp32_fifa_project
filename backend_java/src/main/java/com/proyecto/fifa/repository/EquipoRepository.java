package com.proyecto.fifa.repository;

import com.proyecto.fifa.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EquipoRepository extends JpaRepository<Usuario, Integer> {
    Usuario findByCodigo(Integer codigo);
}