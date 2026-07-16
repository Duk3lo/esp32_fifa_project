package com.proyecto.fifa.repository;

import com.proyecto.fifa.model.Pronostico;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PronosticoRepository extends JpaRepository<Pronostico, Integer> {
}