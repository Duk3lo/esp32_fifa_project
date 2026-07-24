let appState = { connected: true };
const JAVA_API_BASE = "http://localhost:8081";
let lastKeypadId = 0;
let isPolling = false;

window.addEventListener("load", () => {
    cargarPinesHardware();
    cargarEquipos();
    cargarPartidosAdmin();
    if (typeof connectWebSocket === "function") connectWebSocket();
    setInterval(async () => {
        try {
            let res = await fetch("/api/status");
            let data = await res.json();
            appState.connected = data.connected;
            if (!data.connected) {
                window.location.href = "/";
            } else {
                if (typeof WifiUI !== "undefined") WifiUI.setCurrentSsid(data.ssid);
            }
        } catch (e) { }
    }, 4000);
});

function showTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (btnElement) btnElement.classList.add('active');

    if (tabId === 'tab-wifi' && typeof WifiUI !== "undefined") WifiUI.loadSaved();
    if (tabId === 'tab-stats') cargarReportes();
    if (tabId === 'tab-admin') { cargarPartidosAdmin(); cargarEquipos(); }
    if (tabId === 'tab-datos') {
        cargarEquiposBD();
        cargarUsuariosBD();
        cargarPronosticosBD();
    }

    if (tabId === 'tab-predict') {
        const msgEl = document.getElementById("predict-msg");
        if (msgEl) {
            msgEl.innerText = "";
            msgEl.className = "status-msg mt-3";
        }
        document.getElementById("partido-codigo").value = "";
        document.getElementById("goles-a").value = "";
        document.getElementById("goles-b").value = "";
    }
}

function simularLedVirtual(color, tiempoMs) {
    const led = document.getElementById(`v-led-${color}`);
    if (led) {
        led.classList.add("on");
        setTimeout(() => led.classList.remove("on"), tiempoMs);
    }
}

function animarTeclaVirtual(key) {
    const botones = document.querySelectorAll('.vk-btn');
    botones.forEach(btn => {
        if (btn.innerText.trim() === key) {
            btn.classList.add('pressed');
            setTimeout(() => btn.classList.remove('pressed'), 200);
        }
    });
}

let html5QrCode = null;

function handleQrUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    detenerCamara();
    const status = document.getElementById("qr-status");
    status.innerText = "Analizando imagen de la galería...";
    status.className = "status-badge waiting mt-3";

    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
    html5QrCode.scanFile(file, true)
        .then(decodedText => {
            document.getElementById("qr-input-file").value = "";
            validarYEntrar(decodedText);
        }).catch(err => {
            status.innerText = "Imagen sin QR, borrosa o inválida.";
            status.className = "status-badge error mt-3";
            simularLedVirtual("red", 1500);
            document.getElementById("qr-input-file").value = "";
        });
}

function iniciarCamara() {
    const status = document.getElementById("qr-status");
    document.getElementById("reader").style.display = "block";
    document.getElementById("btn-stop-cam").style.display = "block";
    status.innerText = "Iniciando cámara...";
    status.className = "status-badge waiting mt-3";

    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");

    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            detenerCamara();
            validarYEntrar(decodedText);
        },
        (errorMessage) => { }
    ).catch(err => {
        console.error("Error de cámara:", err);
        status.innerText = "Error de cámara: " + err.name + " - " + err.message;
        status.className = "status-badge error mt-3";
        simularLedVirtual("red", 1500);
    });
}

function activarLed(color, tiempoMs = 1000) {
    simularLedVirtual(color, tiempoMs);
    sendWsMessage("java_led_cmd", { color: color, state: "on" });
    setTimeout(() => {
        sendWsMessage("java_led_cmd", { color: color, state: "off" });
    }, tiempoMs);
}

function detenerCamara() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            document.getElementById("reader").style.display = "none";
            document.getElementById("btn-stop-cam").style.display = "none";
        }).catch(err => console.log("Error al detener cámara", err));
    } else {
        document.getElementById("reader").style.display = "none";
        document.getElementById("btn-stop-cam").style.display = "none";
    }
}

let usuarioActualWeb = 1234;

async function enviarPronostico() {
    const codRaw = document.getElementById("partido-codigo").value;
    const cod = parseInt(codRaw.replace(/\D/g, ''));
    const ga = document.getElementById("goles-a").value;
    const gb = document.getElementById("goles-b").value;

    if (!cod || !ga || !gb) { alert("Completa todos los campos"); return; }

    document.getElementById("predict-msg").innerText = "Guardando...";
    document.getElementById("predict-msg").className = "status-badge waiting mt-3";

    try {
        let res = await fetch(`${JAVA_API_BASE}/api/pronosticos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                idPartido: cod,
                golesA: parseInt(ga),
                golesB: parseInt(gb),
                usuarioCodigo: usuarioActualWeb
            })
        });

        if (res.ok) {
            sendWsMessage("predict", { match: cod, goalsA: ga, goalsB: gb });
            simularLedVirtual("blue", 1500);

            document.getElementById("predict-msg").innerText = "¡Pronóstico Guardado en la Base de Datos!";
            document.getElementById("predict-msg").className = "status-badge success mt-3";

            document.getElementById("partido-codigo").value = "";
            document.getElementById("goles-a").value = "";
            document.getElementById("goles-b").value = "";
            document.getElementById("partido-codigo").focus();
        } else {
            const errorMsg = await res.text();
            document.getElementById("predict-msg").innerText = "Error: " + errorMsg;
            document.getElementById("predict-msg").className = "status-badge error mt-3";

            activarLed("orange", 800);
            setTimeout(() => activarLed("red", 1000), 800);
        }
    } catch (error) {
        document.getElementById("predict-msg").innerText = "Error de conexión con Java.";
        document.getElementById("predict-msg").className = "status-badge error mt-3";
        activarLed("red", 2000);
    }
}

function sendWsMessage(type, payload) {
    if (typeof ws !== 'undefined' && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
    }
}

async function cargarPinesHardware() {
    try {
        let res = await fetch("/api/hw/config");
        let data = await res.json();
        if (document.getElementById("pin-led-g")) {
            document.getElementById("pin-led-g").value = data.led_g || "";
            document.getElementById("pin-led-r").value = data.led_r || "";
            document.getElementById("pin-led-b").value = data.led_b || "";
            document.getElementById("pin-led-o").value = data.led_o || "";
            document.getElementById("pin-filas").value = data.filas || "";
            document.getElementById("pin-cols").value = data.cols || "";
        }
    } catch (e) { }
}


async function guardarHardware() {
    const config = {
        led_g: parseInt(document.getElementById("pin-led-g").value),
        led_r: parseInt(document.getElementById("pin-led-r").value),
        led_b: parseInt(document.getElementById("pin-led-b").value),
        led_o: parseInt(document.getElementById("pin-led-o").value) || 0,
        filas: document.getElementById("pin-filas").value,
        cols: document.getElementById("pin-cols").value
    };
    try {
        await fetch("/api/hw/config", { method: "POST", body: JSON.stringify(config) });
        if (confirm("Guardado correctamente. ¿Reiniciar el ESP32 para aplicar?")) {
            fetch("/api/reboot", { method: "POST" });
            alert("Reiniciando...");
            setTimeout(() => location.reload(), 5000);
        }
    } catch (e) { alert("Error al guardar"); }
}


let chartPronosticos = null;

async function cargarReportes() {
    await cargarConteoPronosticos();
    await cargarRanking();
}

async function cargarConteoPronosticos() {
    try {
        let res = await fetch(`${JAVA_API_BASE}/api/reportes/cantidad-por-usuario`);
        let data = await res.json();

        const labels = data.map(d => d.usuario);
        const valores = data.map(d => d.cantidad);

        const ctx = document.getElementById("chart-pronosticos");
        if (chartPronosticos) chartPronosticos.destroy();

        chartPronosticos = new Chart(ctx, {
            type: "bar",
            data: { labels, datasets: [{ label: "Pronósticos", data: valores, backgroundColor: "#00d2ff" }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }
        });
    } catch (e) { }
}

async function cargarRanking() {
    const tbody = document.querySelector("#tabla-ranking tbody");
    try {
        let res = await fetch(`${JAVA_API_BASE}/api/reportes/ranking`);
        let data = await res.json();

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Sin pronósticos registrados</td></tr>`;
            return;
        }
        tbody.innerHTML = data.map((r, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${r.usuario}</td>
                <td style="color:var(--success)">${r.acertados || 0}</td>
                <td style="color:var(--danger)">${r.fallados || 0}</td>
                <td>${r.pronosticos_totales || 0}</td>
            </tr>
        `).join("");
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);">Error conectando con Java</td></tr>`;
    }
}

function simularTecla(key) {
    animarTeclaVirtual(key);
    procesarIngresoTeclado(key);
}

setInterval(async () => {
    if (!document.getElementById("partido-codigo")) return;
    if (isPolling) return;

    isPolling = true;
    try {
        let res = await fetch(`/api/keypad/poll?last_id=${lastKeypadId}`);
        let data = await res.json();

        if (data.keys && data.keys.length > 0) {
            data.keys.forEach(key => {
                animarTeclaVirtual(key);
                procesarIngresoTeclado(key);
            });
        }

        if (data.last_id !== undefined) {
            lastKeypadId = data.last_id;
        }
    } catch (e) {
    } finally {
        isPolling = false;
    }
}, 400);

function procesarIngresoTeclado(key) {
    let activeEl = document.activeElement;
    if (activeEl.tagName !== "INPUT") activeEl = document.getElementById("partido-codigo");

    if (key === '#') {
        if (!activeEl.value || activeEl.value.trim() === '') {
            activarLed("orange", 1500);
        } else {
            if (activeEl.id === "partido-codigo") {
                document.getElementById("goles-a").focus();
                activarLed("green", 1000);
            } else if (activeEl.id === "goles-a") {
                document.getElementById("goles-b").focus();
                activarLed("green", 1000);
            } else if (activeEl.id === "goles-b") {
                activarLed("green", 500);
                setTimeout(() => {
                    enviarPronostico();
                }, 500);
            }
        }
    }
    else if (key === '*') {
        activarLed("orange", 800);
        setTimeout(() => activarLed("red", 1000), 800);

        document.getElementById("predict-msg").innerText = "Pronóstico cancelado. En espera de nuevo código.";
        document.getElementById("predict-msg").className = "status-badge error mt-3";

        document.getElementById("partido-codigo").value = "";
        document.getElementById("goles-a").value = "";
        document.getElementById("goles-b").value = "";
        document.getElementById("partido-codigo").focus();
    }
    else if (key === 'D') {

        activeEl.value = activeEl.value.slice(0, -1);
    }
    else {

        activeEl.value += key;
    }
}


async function validarYEntrar(code) {
    const status = document.getElementById("qr-status");
    status.innerText = "Validando en la base de datos...";
    status.className = "status-badge waiting mt-3";

    try {
        let res = await fetch(`${JAVA_API_BASE}/api/usuarios/validar/${code}`);

        if (res.ok) {
            usuarioActualWeb = parseInt(code);
            status.innerText = "¡Autenticado con éxito!";
            status.className = "status-badge success mt-3";
            activarLed("green", 1000);
            setTimeout(() => {
                document.getElementById("predict-form").style.opacity = "1";
                document.getElementById("predict-form").style.pointerEvents = "auto";
                showTab('tab-predict', document.querySelectorAll('.nav-btn')[5]);
            }, 800);

        } else {
            status.innerText = "Error: Código de usuario no existe.";
            status.className = "status-badge error mt-3";
            activarLed("red", 1500);
        }
    } catch (error) {
        status.innerText = "Error conectando con Java.";
        status.className = "status-badge error mt-3";
        activarLed("red", 1500);
    }
}

function ingresoManual() {
    const code = document.getElementById("manual-code-input").value.trim();
    if (!code) {
        alert("Por favor ingresa un código válido.");
        return;
    }
    document.getElementById("manual-code-input").value = "";
    validarYEntrar(code);
}

async function crearPartido() {
    const id = document.getElementById("admin-id-partido").value;
    const eqA = document.getElementById("admin-equipo-a").value;
    const eqB = document.getElementById("admin-equipo-b").value;
    const fecha = document.getElementById("admin-fecha-partido").value;
    const hora = document.getElementById("admin-hora-partido").value;

    if (!id || !eqA || !eqB || !fecha || !hora) return alert("Completa todos los campos");

    try {
        let res = await fetch(`${JAVA_API_BASE}/api/partidos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                idPartido: parseInt(id),
                idEquipoA: parseInt(eqA),
                idEquipoB: parseInt(eqB),
                fecha: fecha,
                hora: hora + ":00"
            })
        });

        if (res.ok) {
            alert("¡Partido creado correctamente!");
            document.getElementById("admin-id-partido").value = "";
            cargarPartidosAdmin();
        } else {
            const err = await res.text();
            alert("Error al crear el partido: " + err);
        }
    } catch (e) {
        alert("Error de conexión con Java.");
    }
}

async function guardarResultadoReal() {
    const id = document.getElementById("res-id-partido").value;
    const ga = document.getElementById("res-goles-a").value;
    const gb = document.getElementById("res-goles-b").value;

    if (!id || !ga || !gb) return alert("Completa todos los campos");

    let res = await fetch(`${JAVA_API_BASE}/api/partidos/${id}/resultado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            golesEquipoA: parseInt(ga),
            golesEquipoB: parseInt(gb)
        })
    });

    if (res.ok) {
        alert("Resultado real guardado. Las estadísticas se han actualizado.");
        document.getElementById("res-id-partido").value = "";
        document.getElementById("res-goles-a").value = "";
        document.getElementById("res-goles-b").value = "";
    } else {
        alert("Error: Partido no encontrado.");
    }
}

async function cargarPartidosAdmin() {
    const tbody = document.querySelector("#tabla-partidos-admin tbody");
    if (!tbody) return;
    try {
        let res = await fetch(`${JAVA_API_BASE}/api/partidos`);
        let data = await res.json();

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No hay partidos registrados</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${p.idPartido}</td>
                <td>${p.fecha}</td>
                <td>${p.hora}</td>
                <td>${p.equipoA.equipo}</td> 
                <td>${p.equipoB.equipo}</td>
                <td>
                    <button class="btn-cancel btn-small" onclick="eliminarPartido(${p.idPartido})">Eliminar</button>
                </td>
            </tr>
        `).join("");
    } catch (e) { }
}

async function eliminarPartido(id) {
    if (!confirm("¿Estás seguro de eliminar el partido " + id + "?")) return;
    try {
        let res = await fetch(`${JAVA_API_BASE}/api/partidos/${id}`, { method: "DELETE" });
        if (res.ok) {
            alert("Partido eliminado con éxito.");
            cargarPartidosAdmin();

            if (partidoModificarId == id) {
                document.getElementById("mod-equipo-a").disabled = true;
                document.getElementById("mod-equipo-b").disabled = true;
                document.getElementById("btn-actualizar-partido").disabled = true;
                document.getElementById("mod-msg").innerText = "";
                document.getElementById("mod-id-partido").value = "";
                partidoModificarId = null;
            }
        } else {
            alert("No se puede eliminar (quizás ya tiene pronósticos vinculados).");
        }
    } catch (e) {
        alert("Error de conexión al servidor Java.");
    }
}

async function cargarEquipos() {
    try {
        let res = await fetch(`${JAVA_API_BASE}/api/equipos`);
        let equipos = await res.json();
        let options = `<option value="">Seleccione un equipo...</option>` +
            equipos.map(e => `<option value="${e.idEquipo}">${e.equipo}</option>`).join("");

        document.getElementById("admin-equipo-a").innerHTML = options;
        document.getElementById("admin-equipo-b").innerHTML = options;
        document.getElementById("mod-equipo-a").innerHTML = options;
        document.getElementById("mod-equipo-b").innerHTML = options;
    } catch (e) { console.log("Error cargando equipos", e); }
}

let partidoModificarId = null;
async function buscarPartidoModificar() {
    const id = document.getElementById("mod-id-partido").value;
    if (!id) return alert("Ingrese un código a buscar");
    try {
        let res = await fetch(`${JAVA_API_BASE}/api/partidos/${id}`);
        if (res.ok) {
            let p = await res.json();
            let resCheck = await fetch(`${JAVA_API_BASE}/api/partidos/${id}/verificar-pronosticos`);
            let tienePronosticos = await resCheck.json();

            if (tienePronosticos) {
                document.getElementById("mod-equipo-a").disabled = true;
                document.getElementById("mod-equipo-b").disabled = true;
                document.getElementById("btn-actualizar-partido").disabled = true;
                document.getElementById("mod-msg").innerText = "No se puede modificar, existen pronósticos vinculados.";
                document.getElementById("mod-msg").className = "status-msg error mt-2";
                partidoModificarId = null;
                return;
            }
            partidoModificarId = p.idPartido;
            document.getElementById("mod-equipo-a").value = p.equipoA.idEquipo;
            document.getElementById("mod-equipo-b").value = p.equipoB.idEquipo;
            document.getElementById("mod-equipo-a").disabled = false;
            document.getElementById("mod-equipo-b").disabled = false;
            document.getElementById("btn-actualizar-partido").disabled = false;
            document.getElementById("mod-msg").innerText = "Partido encontrado. Modifica los equipos y presiona Actualizar.";
            document.getElementById("mod-msg").className = "status-msg success mt-2";
        } else {
            alert("Partido no encontrado");
        }
    } catch (e) { alert("Error de conexión con Java"); }
}


async function actualizarPartido() {
    if (!partidoModificarId) return;
    const eqA = document.getElementById("mod-equipo-a").value;
    const eqB = document.getElementById("mod-equipo-b").value;
    try {
        let res = await fetch(`${JAVA_API_BASE}/api/partidos/${partidoModificarId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                idEquipoA: parseInt(eqA),
                idEquipoB: parseInt(eqB)
            })
        });
        if (res.ok) {
            alert("¡Partido actualizado correctamente!");
            cargarPartidosAdmin();
            document.getElementById("mod-equipo-a").disabled = true;
            document.getElementById("mod-equipo-b").disabled = true;
            document.getElementById("btn-actualizar-partido").disabled = true;
            document.getElementById("mod-msg").innerText = "";
            document.getElementById("mod-id-partido").value = "";
        } else {
            let err = await res.text();
            alert("Error: " + err);
        }
    } catch (e) { alert("Error de conexión"); }
}

async function buscarParaResultado() {
    const id = document.getElementById("res-id-partido").value;
    if (!id) return alert("Ingrese un código de partido");
    try {
        let res = await fetch(`${JAVA_API_BASE}/api/partidos/${id}`);
        if (res.ok) {
            let p = await res.json();
            document.getElementById("res-lbl-a").innerText = p.equipoA.equipo;
            document.getElementById("res-lbl-b").innerText = p.equipoB.equipo;
            document.getElementById("res-teams-display").style.display = "flex";
        } else {
            alert("Partido no encontrado");
        }
    } catch (e) { alert("Error de conexión"); }
}


async function cargarEquiposBD() {
    const tbody = document.querySelector("#tabla-bd-equipos tbody");
    try {
        let res = await fetch(`${JAVA_API_BASE}/api/equipos`);
        let data = await res.json();
        tbody.innerHTML = data.map(e => `
            <tr>
                <td>${e.idEquipo}</td>
                <td>${e.equipo}</td>
                <td><button class="btn-cancel btn-small" onclick="eliminarEquipoBD(${e.idEquipo})">X</button></td>
            </tr>
        `).join("");
    } catch (e) { }
}

async function crearEquipoBD() {
    const nombre = document.getElementById("nuevo-equipo-nombre").value;
    if (!nombre) return alert("Ingrese un nombre");
    await fetch(`${JAVA_API_BASE}/api/equipos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipo: nombre })
    });
    document.getElementById("nuevo-equipo-nombre").value = "";
    cargarEquiposBD();
    cargarEquipos();
}

async function eliminarEquipoBD(id) {
    if (!confirm("¿Eliminar equipo?")) return;
    let res = await fetch(`${JAVA_API_BASE}/api/equipos/${id}`, { method: "DELETE" });
    if (res.ok) { cargarEquiposBD(); cargarEquipos(); }
    else { alert(await res.text()); }
}


async function cargarUsuariosBD() {
    const tbody = document.querySelector("#tabla-bd-usuarios tbody");
    try {
        let res = await fetch(`${JAVA_API_BASE}/api/usuarios`);
        let data = await res.json();
        tbody.innerHTML = data.map(u => `
            <tr>
                <td>${u.codigo}</td>
                <td>${u.nombre}</td>
                <td><button class="btn-cancel btn-small" onclick="eliminarUsuarioBD(${u.idUsuario})">X</button></td>
            </tr>
        `).join("");
    } catch (e) { }
}

async function crearUsuarioBD() {
    const nombre = document.getElementById("nuevo-user-nombre").value;
    const codigo = document.getElementById("nuevo-user-codigo").value;
    if (!nombre || !codigo) return alert("Complete los campos");
    await fetch(`${JAVA_API_BASE}/api/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre, codigo: parseInt(codigo) })
    });
    document.getElementById("nuevo-user-nombre").value = "";
    document.getElementById("nuevo-user-codigo").value = "";
    cargarUsuariosBD();
}

async function eliminarUsuarioBD(id) {
    if (!confirm("¿Eliminar usuario?")) return;
    let res = await fetch(`${JAVA_API_BASE}/api/usuarios/${id}`, { method: "DELETE" });
    if (res.ok) cargarUsuariosBD();
    else alert(await res.text());
}

async function cargarPronosticosBD() {
    const tbody = document.querySelector("#tabla-bd-pronosticos tbody");
    if (!tbody) return;
    try {
        let res = await fetch(`${JAVA_API_BASE}/api/pronosticos`);
        let data = await res.json();

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No hay pronósticos registrados</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(p => {
            let partidoStr = `${p.partido.equipoA.equipo} vs ${p.partido.equipoB.equipo}`;
            return `
            <tr>
                <td>${p.idPronostico}</td>
                <td>${p.usuario.nombre}</td>
                <td>${partidoStr} <span style="color:var(--text-muted); font-size:11px;">(ID: ${p.partido.idPartido})</span></td>
                <td style="font-weight:bold;">${p.golesEquipoA} - ${p.golesEquipoB}</td>
                <td><button class="btn-cancel btn-small" onclick="eliminarPronosticoBD(${p.idPronostico})">X Eliminar</button></td>
            </tr>
        `}).join("");
    } catch (e) { }
}

async function eliminarPronosticoBD(id) {
    if (!confirm("¿Estás seguro de eliminar este pronóstico? Se restará de las estadísticas.")) return;
    try {
        let res = await fetch(`${JAVA_API_BASE}/api/pronosticos/${id}`, { method: "DELETE" });
        if (res.ok) {
            cargarPronosticosBD();
            cargarReportes();
        } else {
            alert(await res.text());
        }
    } catch (e) { alert("Error de conexión"); }
}