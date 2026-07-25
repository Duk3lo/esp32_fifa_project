# FIFA 2026 - Sistema de Registro de Pronósticos

Repo: https://github.com/Duk3lo/esp32_fifa_project

Este proyecto tiene **3 partes que trabajan juntas** pero corren por separado. Aquí va la idea general para que te ubiques rápido.

## 1. Las 3 partes del proyecto

```
┌─────────────────┐        ┌──────────────────┐        ┌───────────────────┐
│   ESP32 (Rust)  │◄──────►│  Navegador (JS)  │◄──────►│  Backend Java     │
│  Hardware + Web │  HTTP  │  Interfaz web    │  HTTP  │  Spring Boot      │
│  server + WS    │  + WS  │  (index.html)    │        │  + Base de datos  │
└─────────────────┘        └──────────────────┘        └───────────────────┘
     Teclado                   Se ejecuta en          Guarda todo en MySQL
     matricial y                 tu navegador           (equipos, partidos,
     4 LEDs físicos                                     usuarios, pronósticos)
```

**Importante:** el navegador habla con **dos servidores distintos al mismo tiempo**:
- Le habla al **ESP32** (por HTTP y WebSocket) para todo lo relacionado a hardware: teclado físico, LEDs, configuración de pines, Wi-Fi.
- Le habla al **backend Java** (por HTTP normal, `fetch`) para todo lo relacionado a datos: equipos, partidos, usuarios, pronósticos, reportes.

El ESP32 y el backend Java **no se hablan directamente entre sí**. El que conecta a los dos es el navegador.

## 2. Parte ESP32 (Rust / esp-idf)

Es el "cerebro" del hardware. Corre en la placa física y hace 3 cosas:

- **Sirve la página web**: el HTML/CSS/JS del frontend están comprimidos (gzip) y embebidos en el firmware. Cuando entras a la IP del ESP32 desde el navegador, te devuelve esos archivos.
- **Maneja el hardware**: lee el teclado matricial 4x4 en un hilo aparte y guarda las teclas presionadas en un buffer; controla los 4 LEDs (verde, rojo, azul, naranja) prendiéndolos/apagándolos por GPIO.
- **Expone una API propia** (distinta a la de Java) para todo lo de hardware:
  - `GET /api/keypad/poll` → el navegador pregunta cada 400ms si hay teclas nuevas.
  - `GET/POST /api/hw/config` → leer/guardar qué pines GPIO usa cada LED y el teclado.
  - `/api/status`, `/api/scan`, `/api/connect`, etc. → todo lo de Wi-Fi.
  - `WS /ws` → WebSocket para encender/apagar LEDs en tiempo real y simular el flujo de autenticación por QR.

**Librerías clave (solo HTTP/WebSocket):**
- `esp_idf_svc::http::server` (`EspHttpServer`) → levanta el servidor HTTP y registra todas las rutas.
- `esp_idf_svc::ws` (`FrameType`) → maneja los mensajes del WebSocket (`/ws`).
- `serde` / `serde_json` → convierte los mensajes JSON que van y vienen (no es librería de red, pero es necesaria para hablar con el navegador).

## 3. Parte Frontend (HTML + JavaScript)

Es lo que ve el usuario en el navegador. Vive físicamente dentro del ESP32 (se sirve desde ahí), pero **habla con el backend Java directamente**, no a través del ESP32.

Archivos principales:
- `index.html` → estructura de la página (pestañas: QR, Pronósticos, Gestión, Reportería, etc.)
- `js/app.js` → toda la lógica: cambia de pestaña, hace polling del teclado, procesa las teclas (`#` para confirmar, `*` para cancelar), y llama a la API de Java (`JAVA_API_BASE = "http://localhost:8081"`) para guardar/leer partidos, equipos, usuarios y pronósticos.
- `js/websocket.js` → abre y mantiene la conexión WebSocket con el ESP32 (`ws://<ip-del-esp32>/ws`), y sincroniza los LEDs virtuales en pantalla con los físicos.
- `js/wifi.js` → interfaz para configurar la red Wi-Fi del ESP32.

**Librerías usadas (solo conexión):**
- `WebSocket` (API nativa del navegador) → conexión en tiempo real con el ESP32.
- `fetch` (API nativa del navegador) → todas las peticiones HTTP, tanto al ESP32 como a Java.
- (Aparte, para funciones que no son de red: `html5-qrcode` para leer códigos QR y `chart.js` para el gráfico de reportería.)

## 4. Parte Backend (Java / Spring Boot)

Es el que **crea y administra la base de datos**. Corre por separado (por defecto en el puerto `8081`, ver `application.properties`).

- Usa **Spring Data JPA + Hibernate** contra una base de datos **MySQL** (`pronosticosMundial`).
- `spring.jpa.hibernate.ddl-auto=update` → Hibernate crea/actualiza las tablas automáticamente a partir de las clases `@Entity` (`Usuario`, `Equipo`, `Partido`, `Pronostico`). No hay que crear las tablas a mano.
- Al arrancar por primera vez, `CargarDatosIniciales` inserta datos de prueba (2 usuarios, 2 equipos, 1 partido) si la base está vacía.
- Expone una API REST normal (`@RestController`) para todo el CRUD: `/api/equipos`, `/api/usuarios`, `/api/partidos`, `/api/pronosticos`, `/api/reportes/...`.
- Tiene CORS abierto a todos los orígenes (`@CrossOrigin(origins = "*")`) para que el frontend (servido desde el ESP32) pueda llamarlo sin problema.
- Usa `JmDNS` para anunciarse en la red como `fifa-backend.local` (no es obligatorio para que funcione, es solo para facilitar encontrarlo).

**Librerías clave (solo DB y conexión):**
- `spring-boot-starter-data-jpa` → ORM (mapea las clases Java a tablas).
- Driver de **MySQL** (`mysql-connector-j`) → conexión física a la base de datos.
- `spring-boot-starter-web` → levanta el servidor HTTP/REST embebido (Tomcat).

## 5. Resumen del flujo (ejemplo: registrar un pronóstico)

1. El usuario escribe el código del partido y los goles en el teclado físico (o virtual).
2. El **ESP32** detecta las teclas y las expone en `/api/keypad/poll`; el JS las lee y arma el formulario.
3. Al confirmar, el JS hace un `fetch` **directo al backend Java** (`POST /api/pronosticos`) → Java valida, guarda en MySQL y responde.
4. Si Java responde OK, el JS envía un mensaje por **WebSocket al ESP32** (`{"type":"predict"}`) → el ESP32 enciende el LED físico azul un segundo para confirmar visualmente.

Así, cada parte tiene su responsabilidad clara: **ESP32 = hardware**, **JS = puente/interfaz**, **Java = datos**.
