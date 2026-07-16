window.addEventListener("load", () => {
    cargarPinesHardware();
    if (typeof connectWebSocket === "function") connectWebSocket();

    // Redirección si se pierde la conexión y obtención del SSID actual
    setInterval(async () => {
        try {
            let res = await fetch("/api/status");
            let data = await res.json();
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
    
    // Si entramos a la pestaña wifi, cargamos las redes
    if (tabId === 'tab-wifi' && typeof WifiUI !== "undefined") {
        WifiUI.loadSaved();
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

function enviarPronostico() {
    const cod = document.getElementById("partido-codigo").value;
    const ga = document.getElementById("goles-a").value;
    const gb = document.getElementById("goles-b").value;

    if (!cod || !ga || !gb) { alert("Completa todos los campos"); return; }
    document.getElementById("predict-msg").innerText = "Guardando...";
    document.getElementById("predict-msg").className = "status-badge waiting mt-3";
    sendWsMessage("predict", { match: cod, goalsA: ga, goalsB: gb });
}

function sendWsMessage(type, payload) {
    if (typeof ws !== 'undefined' && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
    }
}

// ==========================================
// LÓGICA DE HARDWARE Y TECLADO MATRICIAL
// ==========================================
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