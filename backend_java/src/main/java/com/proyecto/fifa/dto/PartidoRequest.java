package com.proyecto.fifa.dto;

import lombok.Data;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class PartidoRequest {
    private Integer idPartido;
    private LocalDate fecha;
    private LocalTime hora;
    private Integer idEquipoA;
    private Integer idEquipoB;
}