package com.proyecto.fifa.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class RankingDTO {
    private String usuario;
    private String partido;
    private String pronostico;
    private String estado;
}