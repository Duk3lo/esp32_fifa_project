package com.proyecto.fifa.controller;

import com.proyecto.fifa.dto.ConteoPronosticoDTO;
import com.proyecto.fifa.dto.RankingDTO;
import com.proyecto.fifa.model.Partido;
import com.proyecto.fifa.model.Pronostico;
import com.proyecto.fifa.repository.PronosticoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reportes")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ReporteController {

    private final PronosticoRepository pronosticoRepo;

    @GetMapping("/cantidad-por-usuario")
    public List<ConteoPronosticoDTO> cantidadPorUsuario() {
        List<Pronostico> todos = pronosticoRepo.findAllConDetalle();
        Map<String, Long> conteo = todos.stream()
                .collect(Collectors.groupingBy(p -> p.getUsuario().getNombre(), Collectors.counting()));

        return conteo.entrySet().stream()
                .map(e -> new ConteoPronosticoDTO(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    @GetMapping("/ranking")
    public List<RankingDTO> ranking() {
        List<Pronostico> todos = pronosticoRepo.findAllConDetalle();
        Map<String, Long> aciertosPorUsuario = new HashMap<>();
        List<RankingDTO> detalle = new ArrayList<>();

        for (Pronostico p : todos) {
            Partido partido = p.getPartido();
            String nombrePartido = partido.getEquipoA().getEquipo() + " vs " + partido.getEquipoB().getEquipo();
            String pronosticoTexto = p.getGolesEquipoA() + "-" + p.getGolesEquipoB();

            String estado;
            if (partido.getGolesEquipoA() == null || partido.getGolesEquipoB() == null) {
                estado = "PENDIENTE";
            } else if (partido.getGolesEquipoA().equals(p.getGolesEquipoA())
                    && partido.getGolesEquipoB().equals(p.getGolesEquipoB())) {
                estado = "ACIERTO";
                aciertosPorUsuario.merge(p.getUsuario().getNombre(), 1L, Long::sum);
            } else {
                estado = "FALLO";
            }
            detalle.add(new RankingDTO(p.getUsuario().getNombre(), nombrePartido, pronosticoTexto, estado));
        }

        detalle.sort((a, b) -> Long.compare(
                aciertosPorUsuario.getOrDefault(b.getUsuario(), 0L),
                aciertosPorUsuario.getOrDefault(a.getUsuario(), 0L)));

        return detalle;
    }
}