let appState = { connected: true };

const JAVA_API_BASE = "http://localhost:8081";

window.addEventListener("load", () => {
    cargarPinesHardware();
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
        } catch (e) {}
    }, 4000);
});

function showTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (btnElement) btnElement.classList.add('active');
    if (tabId === 'tab-wifi' && typeof WifiUI !== "undefined") {
        WifiUI.loadSaved();
    }
    if (tabId === 'tab-stats') {
        cargarReportes();
    }
}

let html5QrCode = null;

function handleQrUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    detenerCamara(); 

    const status = document.getElementById("qr-status");
    status.innerText = "Analizando imagen de la galería...";
    status.className = "status-badge waiting mt-3";

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    html5QrCode.scanFile(file, true)
        .then(decodedText => {
            status.innerText = "Código detectado, validando...";
            sendWsMessage("auth_qr", { code: decodedText });
            document.getElementById("qr-input-file").value = ""; 
        }).catch(err => {
            status.innerText = "Imagen sin QR, borrosa o inválida.";
            status.className = "status-badge error mt-3";
            document.getElementById("qr-input-file").value = "";
        });
}

function iniciarCamara() {
    const status = document.getElementById("qr-status");
    document.getElementById("reader").style.display = "block";
    document.getElementById("btn-stop-cam").style.display = "block";
    status.innerText = "Iniciando cámara...";
    status.className = "status-badge waiting mt-3";

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            status.innerText = "Código detectado, validando...";
            sendWsMessage("auth_qr", { code: decodedText });
            detenerCamara();
        },
        (errorMessage) => {
        }
    ).catch(err => {
        status.innerText = "Error al iniciar cámara. Da permisos.";
        status.className = "status-badge error mt-3";
    });
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
    
    sendWsMessage("predict", { match: cod, goalsA: ga, goalsB: gb });

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
            document.getElementById("predict-msg").innerText = "¡Pronóstico Guardado en la Base de Datos!";
            document.getElementById("predict-msg").className = "status-badge success mt-3";
            document.getElementById("partido-codigo").value = "";
            document.getElementById("goles-a").value = "";
            document.getElementById("goles-b").value = "";
        } else {
            const errorMsg = await res.text();
            document.getElementById("predict-msg").innerText = "Error: " + errorMsg;
            document.getElementById("predict-msg").className = "status-badge error mt-3";
        }
    } catch (error) {
        console.error("Error de conexión:", error);
        document.getElementById("predict-msg").innerText = "Error de conexión con Java. Pulsa F12 y revisa la consola.";
        document.getElementById("predict-msg").className = "status-badge error mt-3";
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
        if(document.getElementById("pin-led-g")) {
            document.getElementById("pin-led-g").value = data.led_g || "";
            document.getElementById("pin-led-r").value = data.led_r || "";
            document.getElementById("pin-led-b").value = data.led_b || "";
            document.getElementById("pin-filas").value = data.filas || "";
            document.getElementById("pin-cols").value = data.cols || "";
        }
    } catch (e) {}
}

async function guardarHardware() {
    const config = {
        led_g: parseInt(document.getElementById("pin-led-g").value),
        led_r: parseInt(document.getElementById("pin-led-r").value),
        led_b: parseInt(document.getElementById("pin-led-b").value),
        filas: document.getElementById("pin-filas").value,
        cols: document.getElementById("pin-cols").value
    };
    try {
        await fetch("/api/hw/config", { method: "POST", body: JSON.stringify(config) });
        if(confirm("Guardado correctamente. ¿Reiniciar el ESP32 para aplicar?")) {
            fetch("/api/reboot", { method: "POST" });
            alert("Reiniciando...");
            setTimeout(() => location.reload(), 5000);
        }
    } catch (e) { alert("Error al guardar"); }
}

setInterval(async () => {
    if(!document.getElementById("partido-codigo")) return; 
    try {
        let res = await fetch("/api/keypad/poll");
        let data = await res.json();
        
        if (data.keys && data.keys.length > 0) {
            let activeEl = document.activeElement;
            if (activeEl.tagName !== "INPUT") activeEl = document.getElementById("partido-codigo");

            data.keys.forEach(key => {
                if (key === '#') {
                    if (activeEl.id === "partido-codigo") document.getElementById("goles-a").focus();
                    else if (activeEl.id === "goles-a") document.getElementById("goles-b").focus();
                } else if (key === '*') {
                    enviarPronostico();
                } else if (key === 'D') {
                    activeEl.value = activeEl.value.slice(0, -1);
                } else {
                    activeEl.value += key;
                }
            });
        }
    } catch (e) {}
}, 400);

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
            data: {
                labels,
                datasets: [{
                    label: "Pronósticos registrados",
                    data: valores,
                    backgroundColor: "#00d2ff"
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                plugins: { legend: { display: false } }
            }
        });
    } catch (e) {
        console.log("No se pudo cargar el conteo de pronósticos:", e);
    }
}

async function cargarRanking() {
    const tbody = document.querySelector("#tabla-ranking tbody");
    try {
        let res = await fetch(`${JAVA_API_BASE}/api/reportes/ranking`);
        let data = await res.json();

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Sin pronósticos registrados</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(r => `
            <tr>
                <td>${r.usuario}</td>
                <td>${r.partido}</td>
                <td>${r.pronostico}</td>
                <td><span class="estado-badge estado-${r.estado.toLowerCase()}">${r.estado}</span></td>
            </tr>
        `).join("");
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--danger);">No se pudo conectar con el backend Java (revisa JAVA_API_BASE y que esté corriendo)</td></tr>`;
    }
}

function simularTecla(key) {
    let activeEl = document.activeElement;
    if (activeEl.tagName !== "INPUT") {
        activeEl = document.getElementById("partido-codigo");
    }
    if (key === '#') {
        if (activeEl.id === "partido-codigo") {
            document.getElementById("goles-a").focus();
        } else if (activeEl.id === "goles-a") {
            document.getElementById("goles-b").focus();
        }
    } else if (key === '*') {
        enviarPronostico();
    } else if (key === 'D') {
        activeEl.value = activeEl.value.slice(0, -1);
    } else {
        activeEl.value += key;
    }
}

function ingresoManual() {
    const code = document.getElementById("manual-code-input").value;
    if (!code) {
        alert("Por favor ingresa un código válido.");
        return;
    }
    const status = document.getElementById("qr-status");
    status.innerText = "Validando código manual...";
    status.className = "status-badge waiting mt-3";
    usuarioActualWeb = parseInt(code);
    sendWsMessage("auth_qr", { code: code });
    document.getElementById("manual-code-input").value = "";
}

function onScanSuccess(decodedText, decodedResult) {
    document.getElementById("qr-status").innerText = "Validando código...";
    usuarioActualWeb = parseInt(decodedText);
    sendWsMessage("auth_qr", { code: decodedText });
    html5QrcodeScanner.clear();
}