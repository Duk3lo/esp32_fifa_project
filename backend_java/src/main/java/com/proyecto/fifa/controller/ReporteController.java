package com.proyecto.fifa.controller;

import com.proyecto.fifa.dto.ConteoPronosticoDTO;
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
    public List<Map<String, Object>> ranking() {
        List<Pronostico> todos = pronosticoRepo.findAllConDetalle();

        Map<String, Map<String, Object>> agrupado = new HashMap<>();

        for (Pronostico p : todos) {
            String nombreUsuario = p.getUsuario().getNombre();

            agrupado.putIfAbsent(nombreUsuario, new HashMap<>(Map.of(
                    "usuario", nombreUsuario,
                    "acertados", 0,
                    "fallados", 0,
                    "pronosticos_totales", 0
            )));

            Map<String, Object> stats = agrupado.get(nombreUsuario);

            stats.put("pronosticos_totales", (int) stats.get("pronosticos_totales") + 1);

            Partido partido = p.getPartido();

            if (partido.getGolesEquipoA() != null && partido.getGolesEquipoB() != null) {
                if (partido.getGolesEquipoA().equals(p.getGolesEquipoA()) &&
                        partido.getGolesEquipoB().equals(p.getGolesEquipoB())) {
                    // Pronóstico idéntico al resultado real = ACIERTO
                    stats.put("acertados", (int) stats.get("acertados") + 1);
                } else {
                    stats.put("fallados", (int) stats.get("fallados") + 1);
                }
            }
        }

        List<Map<String, Object>> listaRanking = new ArrayList<>(agrupado.values());

        listaRanking.sort((a, b) -> Integer.compare((int) b.get("acertados"), (int) a.get("acertados")));

        return listaRanking;
    }
}