package com.proyecto.fifa.controller;

import com.proyecto.fifa.dto.PartidoRequest;
import com.proyecto.fifa.dto.ResultadoRequest;
import com.proyecto.fifa.model.Equipo;
import com.proyecto.fifa.model.Partido;
import com.proyecto.fifa.repository.EquipoRepository;
import com.proyecto.fifa.repository.PartidoRepository;
import com.proyecto.fifa.repository.PronosticoRepository;
import jakarta.annotation.Nonnull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/partidos")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PartidoController {

    private final PartidoRepository partidoRepo;
    private final EquipoRepository equipoRepo;
    private final PronosticoRepository pronosticoRepo;

    @GetMapping
    public List<Partido> listar() {
        return partidoRepo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Partido> buscar(@PathVariable Integer id) {
        return partidoRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> agregar(@Nonnull @RequestBody PartidoRequest req) {
        Equipo equipoA = equipoRepo.findById(req.getIdEquipoA()).orElse(null);
        Equipo equipoB = equipoRepo.findById(req.getIdEquipoB()).orElse(null);
        if (equipoA == null || equipoB == null) {
            return ResponseEntity.badRequest().body("Alguno de los equipos no existe");
        }

        Partido partido = new Partido();
        partido.setIdPartido(req.getIdPartido());
        partido.setFecha(req.getFecha());
        partido.setHora(req.getHora());
        partido.setEquipoA(equipoA);
        partido.setEquipoB(equipoB);
        return ResponseEntity.ok(partidoRepo.save(partido));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> modificar(@PathVariable Integer id, @RequestBody PartidoRequest req) {
        Partido partido = partidoRepo.findById(id).orElse(null);
        if (partido == null) return ResponseEntity.notFound().build();

        if (pronosticoRepo.existsByPartido_IdPartido(id)) {
            return ResponseEntity.badRequest()
                    .body("No se puede modificar, existen pronósticos vinculados");
        }

        Equipo equipoA = equipoRepo.findById(req.getIdEquipoA()).orElse(null);
        Equipo equipoB = equipoRepo.findById(req.getIdEquipoB()).orElse(null);
        if (equipoA == null || equipoB == null) {
            return ResponseEntity.badRequest().body("Alguno de los equipos no existe");
        }

        partido.setEquipoA(equipoA);
        partido.setEquipoB(equipoB);
        if (req.getFecha() != null) partido.setFecha(req.getFecha());
        if (req.getHora() != null) partido.setHora(req.getHora());

        return ResponseEntity.ok(partidoRepo.save(partido));
    }

    @PutMapping("/{id}/resultado")
    public ResponseEntity<?> registrarResultado(@PathVariable Integer id, @RequestBody ResultadoRequest req) {
        Partido partido = partidoRepo.findById(id).orElse(null);
        if (partido == null) return ResponseEntity.notFound().build();

        partido.setGolesEquipoA(req.getGolesEquipoA());
        partido.setGolesEquipoB(req.getGolesEquipoB());
        return ResponseEntity.ok(partidoRepo.save(partido));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Integer id) {
        try {
            partidoRepo.deleteById(id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("No se puede eliminar, el partido ya tiene pronósticos vinculados.");
        }
    }

    @GetMapping("/{id}/verificar-pronosticos")
    public ResponseEntity<Boolean> verificarPronosticos(@PathVariable Integer id) {
        return ResponseEntity.ok(pronosticoRepo.existsByPartido_IdPartido(id));
    }
}