package com.proyecto.fifa.service;

import com.proyecto.fifa.model.*;
import com.proyecto.fifa.repository.*;
import jakarta.annotation.Nonnull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.socket.*;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;

@Service
public class Esp32Service {

    @Value("${esp32.url}") private String espUrl;
    @Value("${esp32.ws}") private String espWsUrl;

    private final UsuarioRepository usuarioRepo;
    private final PartidoRepository partidoRepo;
    private final PronosticoRepository pronosticoRepo;
    private final RestTemplate restTemplate = new RestTemplate();
    private WebSocketSession wsSession;

    private enum Estado { LOGIN, PARTIDO, GOLES_A, GOLES_B }
    private Estado estadoActual = Estado.LOGIN;
    private final StringBuilder buffer = new StringBuilder();

    private Usuario usuarioActual;
    private Partido partidoActual;
    private int golesA;

    private int lastKeypadId = 0;

    public Esp32Service(UsuarioRepository u, PartidoRepository p, PronosticoRepository pr) {
        this.usuarioRepo = u;
        this.partidoRepo = p;
        this.pronosticoRepo = pr;
    }

    @Scheduled(fixedRate = 400)
    public void pollTeclado() {
        try {
            // Ahora enviamos el lastKeypadId en la URL
            String url = espUrl + "/api/keypad/poll?last_id=" + lastKeypadId;
            KeypadResponse resp = restTemplate.getForObject(url, KeypadResponse.class);

            if (resp != null) {
                if (resp.getLast_id() > lastKeypadId) {
                    lastKeypadId = resp.getLast_id();
                }

                if (resp.getKeys() != null && !resp.getKeys().isEmpty()) {
                    for (String key : resp.getKeys()) {
                        procesarTecla(key);
                    }
                }
            }
        } catch (Exception e) {
            // ESP32 Offline
        }
    }

    private void procesarTecla(@Nonnull String tecla) {
        if (tecla.equals("#") || tecla.equals("*")) {
            String input = buffer.toString();
            buffer.setLength(0);
            ejecutarLogica(input, tecla);
        } else if (tecla.equals("D")) {
            if (!buffer.isEmpty()) buffer.deleteCharAt(buffer.length() - 1);
        } else {
            buffer.append(tecla);
        }
    }

    private void ejecutarLogica(String input, String tecla) {
        try {
            if (input.isEmpty() && estadoActual != Estado.GOLES_A && estadoActual != Estado.GOLES_B) return;

            switch (estadoActual) {
                case LOGIN -> {
                    usuarioActual = usuarioRepo.findByCodigo(Integer.parseInt(input));
                    if (usuarioActual != null) {
                        enviarLed("green");
                        estadoActual = Estado.PARTIDO;
                    } else enviarLed("red");
                }
                case PARTIDO -> {
                    if (tecla.equals("#")) {
                        partidoActual = partidoRepo.findById(Integer.parseInt(input)).orElse(null);
                        if (partidoActual != null) {
                            enviarLed("green");
                            estadoActual = Estado.GOLES_A;
                        } else enviarLed("red");
                    }
                }
                case GOLES_A -> {
                    // Según PDF: Ingresa goles y presiona (#)
                    if (tecla.equals("#")) {
                        golesA = Integer.parseInt(input);
                        enviarLed("green");
                        estadoActual = Estado.GOLES_B;
                    }
                }
                case GOLES_B -> {
                    // Según PDF: Ingresa goles y presiona (*) para finalizar
                    if (tecla.equals("*")) {
                        int golesB = Integer.parseInt(input);

                        Pronostico p = new Pronostico();
                        p.setUsuario(usuarioActual);
                        p.setPartido(partidoActual);
                        p.setGolesEquipoA(golesA);
                        p.setGolesEquipoB(golesB);
                        pronosticoRepo.save(p);

                        enviarLed("blue"); // LED Azul = Registro Correcto
                        estadoActual = Estado.LOGIN;
                    } else {
                        // Si presionó # en lugar de *, podrías dar error o ignorar
                        enviarLed("red");
                    }
                }
            }
        } catch (Exception e) {
            enviarLed("red");
            estadoActual = Estado.LOGIN;
        }
    }

    private void enviarLed(String color) {
        try {
            if (wsSession == null || !wsSession.isOpen()) {
                wsSession = new StandardWebSocketClient().execute(new WebSocketHandler() {
                    @Override public void afterConnectionEstablished(@Nonnull WebSocketSession s) {}
                    @Override public void handleMessage(@Nonnull WebSocketSession s, @Nonnull WebSocketMessage<?> m) {}
                    @Override public void handleTransportError(@Nonnull WebSocketSession s, @Nonnull Throwable t) {}
                    @Override public void afterConnectionClosed(@Nonnull WebSocketSession s, @Nonnull CloseStatus c) {}
                    @Override public boolean supportsPartialMessages() { return false; }
                }, espWsUrl).get();
            }
            // "state": "on" le dice al ESP32 que active el LED y lo maneje él mismo
            String msg = String.format("{\"type\":\"java_led_cmd\",\"payload\":{\"color\":\"%s\",\"state\":\"on\"}}", color);
            wsSession.sendMessage(new TextMessage(msg));
        } catch (Exception e) {
            System.out.println("No se pudo enviar comando LED: " + e.getMessage());
        }
    }
}