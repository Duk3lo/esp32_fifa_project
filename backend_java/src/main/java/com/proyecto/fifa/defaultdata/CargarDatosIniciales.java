package com.proyecto.fifa.defaultdata;

import com.proyecto.fifa.model.Equipo;
import com.proyecto.fifa.model.Partido;
import com.proyecto.fifa.model.Usuario;
import com.proyecto.fifa.repository.EquipoRepository;
import com.proyecto.fifa.repository.PartidoRepository;
import com.proyecto.fifa.repository.UsuarioRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDate;
import java.time.LocalTime;

@Configuration
public class CargarDatosIniciales {

    @Bean
    CommandLineRunner iniciarDatos(UsuarioRepository usuarioRepo,
                                   EquipoRepository equipoRepo,
                                   PartidoRepository partidoRepo) {
        return args -> {
            if (usuarioRepo.count() == 0) {
                Usuario u1 = new Usuario();
                u1.setNombre("Joshue Avecillas");
                u1.setCodigo(1234);

                Usuario u2 = new Usuario();
                u2.setNombre("Juan José Abril");
                u2.setCodigo(5678);

                usuarioRepo.save(u1);
                usuarioRepo.save(u2);
                System.out.println("✅ Usuarios insertados.");
            }

            if (equipoRepo.count() == 0 && partidoRepo.count() == 0) {
                Equipo eq1 = new Equipo();
                eq1.setEquipo("Ecuador");

                Equipo eq2 = new Equipo();
                eq2.setEquipo("Qatar");

                equipoRepo.save(eq1);
                equipoRepo.save(eq2);

                Partido p1 = new Partido();
                p1.setIdPartido(1);
                p1.setEquipoA(eq1);
                p1.setEquipoB(eq2);
                p1.setFecha(LocalDate.now());
                p1.setHora(LocalTime.now());

                partidoRepo.save(p1);
                System.out.println("✅ Partido de prueba insertado (Código: 1 -> Ecuador vs Qatar).");
            }
        };
    }
}