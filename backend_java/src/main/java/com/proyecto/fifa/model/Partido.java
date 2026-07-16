package com.proyecto.fifa.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Data
public class Partido {
    @Id
    private Integer idPartido;
    private LocalDate fecha;
    private LocalTime hora;
    private Integer golesEquipoA;
    private Integer golesEquipoB;

    @ManyToOne
    @JoinColumn(name = "idEquipoA")
    private Equipo equipoA;

    @ManyToOne
    @JoinColumn(name = "idEquipoB")
    private Equipo equipoB;
}