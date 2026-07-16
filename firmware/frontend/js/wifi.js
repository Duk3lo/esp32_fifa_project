const WifiUI = (() => {
    let pendingNetwork = null;
    let scanPollInterval = null;
    let scanTimeoutHandle = null;
    let currentConnectedSsid = "";

    function setCurrentSsid(ssid) {
        currentConnectedSsid = ssid;
    }

    // Listener para validar longitud de la contraseña en tiempo real
    document.addEventListener("DOMContentLoaded", () => {
        const passInput = document.getElementById("wifi-modal-pass");
        if (passInput) {
            passInput.addEventListener("input", (e) => {
                if (pendingNetwork && pendingNetwork.secured) {
                    document.getElementById("btn-conectar").disabled = e.target.value.length < 8;
                }
            });
        }
    });

    async function scan() {
        const list = document.getElementById("wifi-scan-list");
        const btn = document.getElementById("wifi-scan-btn");

        list.innerHTML = "<li class='network-empty'>Buscando redes...</li>";
        if (btn) btn.disabled = true;
        stopScanPolling();

        try {
            await fetch("/api/scan", { method: "POST" });
            scanPollInterval = setInterval(pollScan, 1000);
            scanTimeoutHandle = setTimeout(() => {
                stopScanPolling();
                if (list.innerHTML.includes("Buscando")) {
                    list.innerHTML = "<li class='network-empty' style='color:#ff4a4a;'>El escaneo tardó demasiado.</li>";
                }
            }, 15000);
        } catch (e) {
            setStatus("Error al iniciar escaneo", "red");
            if (btn) btn.disabled = false;
        }
    }

    async function pollScan() {
        try {
            let res = await fetch("/api/scan");
            let data = await res.json();
            if (data.status === "done") {
                stopScanPolling();
                renderScanResults(data.networks || []);
            } else if (data.status === "error") {
                stopScanPolling();
                setStatus("Error: " + data.msg, "red");
            }
        } catch (e) {}
    }

    function stopScanPolling() {
        if (scanPollInterval) { clearInterval(scanPollInterval); scanPollInterval = null; }
        if (scanTimeoutHandle) { clearTimeout(scanTimeoutHandle); scanTimeoutHandle = null; }
        const btn = document.getElementById("wifi-scan-btn");
        if (btn) btn.disabled = false;
    }

    async function loadSaved() {
        try {
            let resStatus = await fetch("/api/status");
            let dataStatus = await resStatus.json();
            currentConnectedSsid = dataStatus.ssid || "";

            let res = await fetch("/api/saved");
            let data = await res.json();
            renderSavedNetworks(data.networks || []);
        } catch (e) {}
    }

    async function confirmConnect() {
        if (!pendingNetwork) return;
        const pass = document.getElementById("wifi-modal-pass").value;
        const reqData = {
            ssid: pendingNetwork.ssid,
            pass: pass,
            auth_type: pendingNetwork.secured ? "WPA2" : "Open"
        };
        
        setStatus(`Conectando a "${pendingNetwork.ssid}"...`, "#aaa");
        closeModal();

        try {
            let res = await fetch("/api/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reqData)
            });
            let data = await res.json();
            if (res.ok && data.status === "success") {
                setStatus("¡Conectado! Cambiando a Modo Cliente...", "green");
                setTimeout(() => { window.location.href = "/"; }, 4000);
            } else {
                setStatus("Error al conectar: " + (data.msg || "Desconocido"), "red");
            }
        } catch (e) {
            setStatus("Error de red al intentar conectar", "red");
        }
    }

    async function deleteNetwork(ssid) {
        try {
            await fetch("/api/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ssid })
            });
            setStatus(`Red "${ssid}" eliminada`, "#aaa");
            loadSaved();
        } catch (e) {}
    }

    function renderScanResults(networks) {
        const list = document.getElementById("wifi-scan-list");
        list.innerHTML = "";
        if (!networks || !networks.length) {
            list.innerHTML = `<li class='network-empty'>No se encontraron redes.</li>`;
            return;
        }
        networks.slice().sort((a, b) => b.rssi - a.rssi).forEach(net => {
            const secured = net.auth_method !== "None";
            const isCurrent = (net.ssid === currentConnectedSsid);
            const li = document.createElement("li");
            li.className = "network-item";
            
            li.innerHTML = `
                <span class="network-name">
                    ${secured ? "🔒" : "🔓"} ${net.ssid} 
                    ${isCurrent ? "<span style='color:var(--success); font-size:12px; margin-left:5px;'>(Conectada)</span>" : ""}
                </span>
                <span class="network-signal">${signalBars(net.rssi)}</span>
            `;

            if (isCurrent) {
                li.style.opacity = "0.6";
                li.style.cursor = "not-allowed";
                li.onclick = null; // No permite hacer clic
            } else {
                li.onclick = () => openConnectModal(net.ssid, secured);
            }
            
            list.appendChild(li);
        });
    }

    function renderSavedNetworks(networks) {
        const list = document.getElementById("wifi-saved-list");
        list.innerHTML = "";
        if (!networks.length) {
            list.innerHTML = "<li class='network-empty'>No hay redes guardadas</li>";
            return;
        }
        networks.forEach(net => {
            const isCurrent = (net.ssid === currentConnectedSsid);
            const li = document.createElement("li");
            li.className = "network-item";
            li.innerHTML = `
                <span class="network-name">📶 ${net.ssid} 
                ${isCurrent ? "<span style='color:var(--success); font-size:12px; margin-left:5px;'>(Conectada)</span>" : ""}</span>
                <button class="btn-delete">✕</button>
            `;
            li.querySelector(".btn-delete").onclick = (e) => {
                e.stopPropagation();
                deleteNetwork(net.ssid);
            };
            
            if (isCurrent) {
                li.style.opacity = "0.6";
                li.style.cursor = "not-allowed";
                li.onclick = null;
            } else {
                li.onclick = () => openConnectModal(net.ssid, net.auth_type !== "Open");
            }
            
            list.appendChild(li);
        });
    }

    function openConnectModal(ssid, secured) {
        pendingNetwork = { ssid, secured };
        document.getElementById("wifi-modal-ssid").innerText = `Conectar a "${ssid}"`;
        
        const passInput = document.getElementById("wifi-modal-pass");
        const passLabel = document.getElementById("wifi-modal-pass-label");
        const btn = document.getElementById("btn-conectar");
        
        passInput.value = "";
        
        if (secured) {
            passInput.style.display = "block";
            passLabel.style.display = "block";
            btn.disabled = true; // Empieza bloqueado porque la caja está vacía
        } else {
            passInput.style.display = "none";
            passLabel.style.display = "none";
            btn.disabled = false; // Como es abierta, sí deja conectar directo
        }
        
        document.getElementById("wifi-connect-modal").style.display = "flex";
    }

    function closeModal() { document.getElementById("wifi-connect-modal").style.display = "none"; pendingNetwork = null; }
    function signalBars(rssi) { 
        let s = rssi >= -60 ? 3 : (rssi >= -75 ? 2 : 1);
        let c = s === 3 ? "#00e676" : (s === 2 ? "#ffb300" : "#ff4a4a");
        return `<svg style="vertical-align: middle; margin-left: 8px;" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h.01"></path>
            ${s >= 1 ? '<path d="M8.5 16.42a5 5 0 0 1 7 0"></path>' : ''}
            ${s >= 2 ? '<path d="M5 12.8a10 10 0 0 1 14 0"></path>' : ''}
            ${s >= 3 ? '<path d="M2 8.82a15 15 0 0 1 20 0"></path>' : ''}
        </svg>`;
    }
    function setStatus(msg, color) { const el = document.getElementById("wifi-status"); if (el) { el.innerText = msg; el.style.color = color || "#aaa"; } }

    async function olvidarActual() {
        if(confirm("¿Estás seguro de desconectar el ESP32 de Internet? Volverá al Modo Configuración.")) {
            await fetch("/api/disconnect", { method: "POST" });
            setTimeout(() => window.location.href = "/", 2000);
        }
    }

    return { scan, loadSaved, confirmConnect, closeModal, olvidarActual, setCurrentSsid };
})();