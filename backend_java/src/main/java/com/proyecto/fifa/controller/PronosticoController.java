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
        if (usuario == null) {
            return ResponseEntity.badRequest().body("Usuario no encontrado");
        }
        Partido partido = partidoRepo.findById(req.getIdPartido()).orElse(null);
        if (partido == null) {
            return ResponseEntity.badRequest().body("Partido no encontrado");
        }
        Pronostico p = new Pronostico();
        p.setUsuario(usuario);
        p.setPartido(partido);
        p.setGolesEquipoA(req.getGolesA());
        p.setGolesEquipoB(req.getGolesB());

        return ResponseEntity.ok(pronosticoRepo.save(p));
    }
}