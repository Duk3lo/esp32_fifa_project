package com.proyecto.fifa.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
public class Equipo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idEquipo;
    private String equipo;
}