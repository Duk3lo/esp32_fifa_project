package com.proyecto.fifa.controller;

import com.proyecto.fifa.model.Equipo;
import com.proyecto.fifa.repository.EquipoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/equipos")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class EquipoController {

    private final EquipoRepository equipoRepo;

    @GetMapping
    public List<Equipo> listar() {
        return equipoRepo.findAll();
    }

    @PostMapping
    public Equipo agregar(@RequestBody Equipo equipo) {
        return equipoRepo.save(equipo);
    }
}