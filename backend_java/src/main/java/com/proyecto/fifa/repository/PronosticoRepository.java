package com.proyecto.fifa.repository;

import com.proyecto.fifa.model.Pronostico;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PronosticoRepository extends JpaRepository<Pronostico, Integer> {

    boolean existsByPartido_IdPartido(Integer idPartido);

    @Query("SELECT p FROM Pronostico p JOIN FETCH p.usuario JOIN FETCH p.partido pa " +
            "JOIN FETCH pa.equipoA JOIN FETCH pa.equipoB")
    List<Pronostico> findAllConDetalle();
}