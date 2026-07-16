package com.proyecto.fifa.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ConteoPronosticoDTO {
    private String usuario;
    private Long cantidad;
}