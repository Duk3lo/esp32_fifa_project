function onScanSuccess(decodedText, decodedResult) {
    document.getElementById("qr-status").innerText = "Validando código...";
    // Enviar el QR por WebSocket al ESP32 para que prenda el LED VERDE o ROJO
    sendWsMessage("auth_qr", { code: decodedText });
    html5QrcodeScanner.clear();
}

const html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
html5QrcodeScanner.render(onScanSuccess);