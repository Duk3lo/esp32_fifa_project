use anyhow::Result;
use esp_idf_svc::http::server::{Configuration, EspHttpServer};
use esp_idf_svc::http::Method;
use esp_idf_svc::io::Write;
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use crate::hardware::leds::SharedLeds;
use crate::hardware::keypad::KeyEvent;

use crate::wifi::init::SharedWifi;

const INDEX_HTML: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/index.html.gz"));
const SETUP_HTML: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/setup.html.gz"));
const STYLE_CSS: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/css/style.css.gz"));
const JS_APP: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/js/app.js.gz"));
const JS_WS: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/js/websocket.js.gz"));
const JS_WIFI: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/js/wifi.js.gz"));

#[derive(Deserialize, Serialize)]
struct HwConfigPayload {
    #[serde(default)]
    led_g: u32,
    #[serde(default)]
    led_r: u32,
    #[serde(default)]
    led_b: u32,
    #[serde(default)]
    filas: String,
    #[serde(default)]
    cols: String,
}

fn validar_hw_config(cfg: &HwConfigPayload) -> std::result::Result<(), String> {
    use crate::hardware::pins::is_safe_gpio;

    let mut usados = HashSet::new();

    for (nombre, pin) in [("led_g", cfg.led_g), ("led_r", cfg.led_r), ("led_b", cfg.led_b)] {
        if pin == 0 { continue; }
        if !is_safe_gpio(pin) {
            return Err(format!("Pin {pin} ({nombre}) no es un GPIO seguro"));
        }
        if !usados.insert(pin) {
            return Err(format!("El pin {pin} está asignado a más de una función"));
        }
    }

    for (nombre, valores) in [("filas", &cfg.filas), ("cols", &cfg.cols)] {
        for parte in valores.split(',') {
            let parte = parte.trim();
            if parte.is_empty() { continue; }
            let pin: u32 = parte.parse().map_err(|_| format!("'{parte}' en {nombre} no es un número de pin válido"))?;
            if !is_safe_gpio(pin) {
                return Err(format!("Pin {pin} ({nombre}) no es un GPIO seguro"));
            }
            if !usados.insert(pin) {
                return Err(format!("El pin {pin} está asignado a más de una función"));
            }
        }
    }

    Ok(())
}

pub fn start_web(
    wifi: SharedWifi,
    nvs: EspDefaultNvsPartition,
    scan_state: crate::wifi::scanner::SharedScanState,
    keypad_buf: Arc<Mutex<Vec<KeyEvent>>>,
    shared_leds: SharedLeds,
) -> Result<EspHttpServer<'static>> {
    let http_config = Configuration {
        stack_size: 10240,
        max_uri_handlers: 30,
        ..Default::default()
    };
    let mut server = EspHttpServer::new(&http_config)?;

    let wifi_index = wifi.clone();
    server.fn_handler("/", Method::Get, move |req| -> Result<()> {
        let is_connected = wifi_index.lock().unwrap().is_connected().unwrap_or(false);
        let html_to_serve = if is_connected { INDEX_HTML } else { SETUP_HTML };
        req.into_response(200, Some("OK"), &[("Content-Encoding", "gzip"), ("Content-Type", "text/html")])?
            .write_all(html_to_serve)?;
        Ok(())
    })?;

    server.fn_handler("/css/style.css", Method::Get, |req| -> Result<()> {
        req.into_response(200, Some("OK"), &[("Content-Encoding", "gzip"), ("Content-Type", "text/css")])?.write_all(STYLE_CSS)?; Ok(())
    })?;
    server.fn_handler("/js/app.js", Method::Get, |req| -> Result<()> {
        req.into_response(200, Some("OK"), &[("Content-Encoding", "gzip"), ("Content-Type", "application/javascript")])?.write_all(JS_APP)?; Ok(())
    })?;
    server.fn_handler("/js/websocket.js", Method::Get, |req| -> Result<()> {
        req.into_response(200, Some("OK"), &[("Content-Encoding", "gzip"), ("Content-Type", "application/javascript")])?.write_all(JS_WS)?; Ok(())
    })?;
    server.fn_handler("/js/wifi.js", Method::Get, |req| -> Result<()> {
        req.into_response(200, Some("OK"), &[("Content-Encoding", "gzip"), ("Content-Type", "application/javascript")])?.write_all(JS_WIFI)?; Ok(())
    })?;

    server.fn_handler("/api/keypad/poll", Method::Get, move |req| -> Result<()> {
        let query = req.uri().split('?').nth(1).unwrap_or("");
        let last_id: usize = query.split("last_id=")
            .nth(1)
            .unwrap_or("0")
            .split('&')
            .next()
            .unwrap_or("0")
            .parse()
            .unwrap_or(0);

        let buffer = keypad_buf.lock().unwrap();

        let new_keys: Vec<char> = buffer.iter()
            .filter(|k| k.id > last_id)
            .map(|k| k.key)
            .collect();

        let max_id = buffer.last().map(|k| k.id).unwrap_or(last_id);

        req.into_response(200, Some("OK"), &[("Content-Type", "application/json")])?
            .write_all(json!({ "keys": new_keys, "last_id": max_id }).to_string().as_bytes())?;
        Ok(())
    })?;

    let nvs_hw_post = nvs.clone();
    server.fn_handler("/api/hw/config", Method::Post, move |mut req| -> Result<()> {
        let mut buf = vec![0; 1024];
        let len = req.read(&mut buf).unwrap_or(0);

        let raw = match String::from_utf8(buf[..len].to_vec()) {
            Ok(s) => s,
            Err(_) => {
                req.into_response(400, Some("Bad Request"), &[("Content-Type", "application/json")])?
                    .write_all(json!({"status": "error", "msg": "Body no es UTF-8 válido"}).to_string().as_bytes())?;
                return Ok(());
            }
        };

        let payload: HwConfigPayload = match serde_json::from_str(&raw) {
            Ok(p) => p,
            Err(_) => {
                req.into_response(400, Some("Bad Request"), &[("Content-Type", "application/json")])?
                    .write_all(json!({"status": "error", "msg": "JSON inválido"}).to_string().as_bytes())?;
                return Ok(());
            }
        };

        if let Err(msg) = validar_hw_config(&payload) {
            req.into_response(400, Some("Bad Request"), &[("Content-Type", "application/json")])?
                .write_all(json!({"status": "error", "msg": msg}).to_string().as_bytes())?;
            return Ok(());
        }

        let nvs_store = esp_idf_svc::nvs::EspNvs::new(nvs_hw_post.clone(), "hw_cfg", true)?;
        nvs_store.set_str("pins", &serde_json::to_string(&payload)?)?;

        req.into_response(200, Some("OK"), &[])?;
        Ok(())
    })?;

    let nvs_hw_get = nvs.clone();
    server.fn_handler("/api/hw/config", Method::Get, move |req| -> Result<()> {
        let nvs_store = esp_idf_svc::nvs::EspNvs::new(nvs_hw_get.clone(), "hw_cfg", true)?;
        let mut buf = vec![0; 1024];
        let json_str = match nvs_store.get_str("pins", &mut buf)? {
            Some(data) => data, _ => "{}"
        };
        req.into_response(200, Some("OK"), &[("Content-Type", "application/json")])?.write_all(json_str.as_bytes())?; Ok(())
    })?;

    server.fn_handler("/api/reboot", Method::Post, |req| -> Result<()> {
        req.into_response(200, Some("OK"), &[])?;
        unsafe { esp_idf_svc::sys::esp_restart(); }
    })?;

    let wifi_status = wifi.clone();
    server.fn_handler("/api/status", Method::Get, move |req| -> Result<()> {
        let mut is_connected = false;
        let mut current_ssid = String::new();

        if let Ok(lock) = wifi_status.lock() {
            is_connected = lock.is_connected().unwrap_or(false);
            if is_connected {
                if let Ok(config) = lock.get_configuration() {
                    match config {
                        esp_idf_svc::wifi::Configuration::Client(c) => current_ssid = c.ssid.as_str().to_string(),
                        esp_idf_svc::wifi::Configuration::Mixed(c, _) => current_ssid = c.ssid.as_str().to_string(),
                        _ => {}
                    }
                }
            }
        }

        req.into_response(200, Some("OK"), &[("Content-Type", "application/json")])?
            .write_all(json!({"connected": is_connected, "ssid": current_ssid}).to_string().as_bytes())?;
        Ok(())
    })?;

    let wifi_dis = wifi.clone();
    server.fn_handler("/api/disconnect", Method::Post, move |req| -> Result<()> {
        let mut lock = wifi_dis.lock().unwrap();
        let _ = lock.disconnect();
        req.into_response(200, Some("OK"), &[])?; Ok(())
    })?;

    let wifi_scan = wifi.clone();
    let scan_state_post = scan_state.clone();
    server.fn_handler("/api/scan", Method::Post, move |req| -> Result<()> {
        match crate::wifi::scanner::start_scan_async(wifi_scan.clone(), scan_state_post.clone()) {
            Ok(_) => req.into_response(200, Some("OK"), &[("Content-Type", "application/json")])?.write_all(json!({"status": "started"}).to_string().as_bytes())?,
            Err(_) => req.into_response(200, Some("OK"), &[("Content-Type", "application/json")])?.write_all(json!({"status": "pending"}).to_string().as_bytes())?,
        }
        Ok(())
    })?;

    let scan_state_get = scan_state.clone();
    server.fn_handler("/api/scan", Method::Get, move |req| -> Result<()> {
        let result = crate::wifi::scanner::poll_scan_state(&scan_state_get);
        let json_resp = match result {
            crate::wifi::scanner::ScanState::Done(networks) => json!({ "status": "done", "networks": networks }),
            crate::wifi::scanner::ScanState::Error(msg) => json!({ "status": "error", "msg": msg }),
            _ => json!({ "status": "pending" }),
        };
        req.into_response(200, Some("OK"), &[("Content-Type", "application/json")])?.write_all(json_resp.to_string().as_bytes())?;
        Ok(())
    })?;

    let nvs_saved = nvs.clone();
    server.fn_handler("/api/saved", Method::Get, move |req| -> Result<()> {
        let saved = crate::wifi::storage::get_saved_networks(&nvs_saved).unwrap_or_default();
        req.into_response(200, Some("OK"), &[("Content-Type", "application/json")])?.write_all(json!({ "networks": saved }).to_string().as_bytes())?;
        Ok(())
    })?;

    let nvs_del = nvs.clone();
    server.fn_handler("/api/delete", Method::Post, move |mut req| -> Result<()> {
        let mut buf = vec![0; 512];
        if let Ok(len) = req.read(&mut buf) {
            let raw = String::from_utf8_lossy(&buf[..len]);
            if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(ssid) = json_val.get("ssid").and_then(|v| v.as_str()) {
                    let _ = crate::wifi::storage::delete_network(&nvs_del, ssid);
                }
            }
        }
        req.into_response(200, Some("OK"), &[("Content-Type", "application/json")])?.write_all(json!({"status": "success"}).to_string().as_bytes())?;
        Ok(())
    })?;

    let wifi_conn = wifi.clone();
    let nvs_conn = nvs.clone();
    server.fn_handler("/api/connect", Method::Post, move |mut req| -> Result<()> {
        let mut buf = vec![0; 1024];
        let len = req.read(&mut buf).unwrap_or(0);
        let raw = String::from_utf8_lossy(&buf[..len]).to_string();

        let conn_req = match serde_json::from_str::<crate::wifi::connection::ConnectRequest>(&raw) {
            Ok(r) => r,
            Err(_) => {
                req.into_response(400, Some("Bad Request"), &[])?;
                return Ok(());
            }
        };

        let to_save = crate::wifi::storage::SavedNetwork {
            ssid: conn_req.ssid.clone(),
            pass: conn_req.pass.clone(),
            auth_type: conn_req.auth_type.clone(),
            user: conn_req.user.clone(),
            anon_identity: conn_req.anon_identity.clone(),
            eap_method: conn_req.eap_method.clone(),
            phase2: conn_req.phase2.clone(),
        };


        let (tx, rx) = std::sync::mpsc::channel();
        let wifi_thread = wifi_conn.clone();
        let nvs_thread = nvs_conn.clone();
        std::thread::spawn(move || {
            let result = crate::wifi::connection::connect_to_wifi(wifi_thread, &nvs_thread, conn_req);
            let _ = tx.send(result);
        });

        match rx.recv_timeout(std::time::Duration::from_secs(12)) {
            Ok(Ok(_)) => {
                let _ = crate::wifi::storage::save_network(&nvs_conn, to_save);
                req.into_response(200, Some("OK"), &[("Content-Type", "application/json")])?
                    .write_all(json!({"status": "success"}).to_string().as_bytes())?;
            }
            Ok(Err(e)) => {
                req.into_response(400, Some("Bad Request"), &[("Content-Type", "application/json")])?
                    .write_all(json!({"status": "error", "msg": e.to_string()}).to_string().as_bytes())?;
            }
            Err(_) => {
                req.into_response(504, Some("Gateway Timeout"), &[("Content-Type", "application/json")])?
                    .write_all(json!({"status": "error", "msg": "Tiempo de espera agotado al conectar"}).to_string().as_bytes())?;
            }
        }
        Ok(())
    })?;

    let wifi_ws = wifi.clone();
    crate::web::ws::register_ws_handler(&mut server, shared_leds, wifi_ws)?;
    Ok(server)
}