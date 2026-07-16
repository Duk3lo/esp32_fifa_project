package com.proyecto.fifa.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
public class Pronostico {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idPronostico;
    private Integer golesEquipoA;
    private Integer golesEquipoB;

    @ManyToOne
    @JoinColumn(name = "idUsuario")
    private Usuario usuario;

    @ManyToOne
    @JoinColumn(name = "idPartido")
    private Partido partido;
}