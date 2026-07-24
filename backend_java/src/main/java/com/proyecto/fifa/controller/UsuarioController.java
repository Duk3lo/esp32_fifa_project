package com.proyecto.fifa.controller;

import com.proyecto.fifa.model.Usuario;
import com.proyecto.fifa.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    @GetMapping
    public List<Usuario> listar() {
        return usuarioRepo.findAll();
    }

    @PostMapping
    public Usuario agregar(@RequestBody Usuario usuario) {
        return usuarioRepo.save(usuario);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Integer id) {
        try {
            usuarioRepo.deleteById(id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("No se puede eliminar, tiene pronósticos vinculados.");
        }
    }
}