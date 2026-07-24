package com.proyecto.fifa.controller;

import com.proyecto.fifa.dto.PronosticoRequest;
import com.proyecto.fifa.model.Partido;
import com.proyecto.fifa.model.Pronostico;
import com.proyecto.fifa.model.Usuario;
import com.proyecto.fifa.repository.PartidoRepository;
import com.proyecto.fifa.repository.PronosticoRepository;
import com.proyecto.fifa.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.jetbrains.annotations.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/pronosticos")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PronosticoController {

    private final PronosticoRepository pronosticoRepo;
    private final PartidoRepository partidoRepo;
    private final UsuarioRepository usuarioRepo;

    @PostMapping
    public ResponseEntity<?> guardarPronosticoWeb(@RequestBody @NotNull PronosticoRequest req) {
        Usuario usuario = usuarioRepo.findByCodigo(req.getUsuarioCodigo());
        if (usuario == null) return ResponseEntity.badRequest().body("Usuario no encontrado");

        Partido partido = partidoRepo.findById(req.getIdPartido()).orElse(null);
        if (partido == null) return ResponseEntity.badRequest().body("Partido no encontrado");

        if (pronosticoRepo.existsByUsuarioAndPartido(usuario, partido)) {
            return ResponseEntity.badRequest().body("Ya registraste un pronóstico para este partido.");
        }

        Pronostico p = new Pronostico();
        p.setUsuario(usuario);
        p.setPartido(partido);
        p.setGolesEquipoA(req.getGolesA());
        p.setGolesEquipoB(req.getGolesB());

        return ResponseEntity.ok(pronosticoRepo.save(p));
    }

    @GetMapping
    public ResponseEntity<?> listarPronosticos() {
        return ResponseEntity.ok(pronosticoRepo.findAllConDetalle());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminarPronostico(@PathVariable Integer id) {
        try {
            pronosticoRepo.deleteById(id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error al eliminar el pronóstico.");
        }
    }
}