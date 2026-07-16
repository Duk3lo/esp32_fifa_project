function onScanSuccess(decodedText, decodedResult) {
    document.getElementById("qr-status").innerText = "Validando código...";
    sendWsMessage("auth_qr", { code: decodedText });
    html5QrcodeScanner.clear();
}

const html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
html5QrcodeScanner.render(onScanSuccess);