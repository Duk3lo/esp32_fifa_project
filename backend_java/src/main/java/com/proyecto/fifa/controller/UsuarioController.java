package com.proyecto.fifa.controller;

import com.proyecto.fifa.model.Usuario;
import com.proyecto.fifa.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UsuarioController {

    private final UsuarioRepository usuarioRepo;

    @GetMapping("/validar/{codigo}")
    public ResponseEntity<?> validarLogin(@PathVariable Integer codigo) {
        Usuario u = usuarioRepo.findByCodigo(codigo);
        if (u != null) {
            return ResponseEntity.ok(u);
        }
        return ResponseEntity.status(404).body("Usuario no encontrado");
    }
}