let ws = null;
let reconnectTimer = null;
const isLocal = window.location.protocol === "file:";

function connectWebSocket() {
    if (isLocal || !appState.connected) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    clearTimeout(reconnectTimer);
    ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onopen = () => console.log("Conectado al ESP32 por WebSocket exitosamente.");

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "auth_success") {
            document.getElementById("qr-status").innerText = "¡Usuario Autenticado!";
            document.getElementById("qr-status").className = "status-badge success";
            document.getElementById("predict-form").style.opacity = "1";
            document.getElementById("predict-form").style.pointerEvents = "auto";
            showTab('tab-predict', document.querySelectorAll('.nav-btn')[1]);
        } else if (data.type === "auth_error") {
            document.getElementById("qr-status").innerText = "Error: QR Inválido o usuario no existe.";
            document.getElementById("qr-status").className = "status-badge error";
        } else if (data.type === "predict_success") {
            document.getElementById("predict-msg").innerText = "¡Pronóstico Guardado!";
            document.getElementById("predict-msg").className = "status-badge success mt-3";
        }

        if (data.type === "led_update") {
            document.getElementById("v-led-green").classList.remove("on");
            document.getElementById("v-led-red").classList.remove("on");
            document.getElementById("v-led-blue").classList.remove("on");

            if (data.color === "green" && data.state === "on") document.getElementById("v-led-green").classList.add("on");
            if (data.color === "red" && data.state === "on") document.getElementById("v-led-red").classList.add("on");
            if (data.color === "blue" && data.state === "on") document.getElementById("v-led-blue").classList.add("on");
        }
    };

    ws.onclose = () => {
        if (appState.connected) {
            reconnectTimer = setTimeout(connectWebSocket, 3000);
        }
    };
    ws.onerror = () => { if (ws) ws.close(); };
}