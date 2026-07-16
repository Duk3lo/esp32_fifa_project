package com.proyecto.fifa.dto;

import lombok.Data;

@Data
public class PronosticoRequest {
    private Integer idPartido;
    private Integer golesA;
    private Integer golesB;
    private Integer usuarioCodigo;
}