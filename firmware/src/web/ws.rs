use anyhow::Result;
use esp_idf_svc::http::server::EspHttpServer;
use esp_idf_svc::ws::FrameType;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

use crate::hardware::leds::SharedLeds;
use crate::wifi::init::SharedWifi;

#[derive(Deserialize)]
struct WsIncoming {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(default)]
    payload: Value,
}

pub fn register_ws_handler(
    server: &mut EspHttpServer<'static>, 
    shared_leds: SharedLeds,
    wifi: SharedWifi
) -> Result<()> {
    server.ws_handler("/ws", None, move |ws| {
        if ws.is_new() || ws.is_closed() { return Ok(()); }

        // 1. REGLA DE SEGURIDAD: Solo procesar si hay conexión WiFi (Modo Estación)
        let is_connected = wifi.lock().unwrap().is_connected().unwrap_or(false);
        if !is_connected {
            let _ = ws.send(
                FrameType::Text(false), 
                json!({"type": "error", "msg": "Modo AP: WebSocket Deshabilitado"}).to_string().as_bytes()
            );
            return Ok(());
        }

        let mut buf = [0_u8; 2048];
        let (_frame_type, len) = match ws.recv(&mut buf) {
            Ok(val) => val,
            Err(_) => return Ok(()),
        };
        if len == 0 { return Ok::<(), esp_idf_svc::sys::EspError>(()); }

        let raw = String::from_utf8_lossy(&buf[..len]);
        if let Ok(msg) = serde_json::from_str::<WsIncoming>(&raw) {
            
            // --- CASO 1: COMANDO DESDE JAVA (PC) ---
            // Java es el cerebro y decide qué LED prender según la lógica de la DB
            if msg.msg_type == "java_led_cmd" {
                let color = msg.payload.get("color").and_then(|v| v.as_str()).unwrap_or("");
                let state = msg.payload.get("state").and_then(|v| v.as_str()).unwrap_or("off");
                
                if let Ok(mut lock) = shared_leds.lock() {
                    if let Some(leds) = lock.as_mut() {
                        leds.turn_off_all();
                        if state == "on" {
                            match color {
                                "green" => { let _ = leds.green.set_high(); },
                                "red" => { let _ = leds.red.set_high(); },
                                "blue" => { let _ = leds.blue.set_high(); },
                                _ => {}
                            }
                        }
                    }
                }
                // Notificar a la WEB para que el LED VIRTUAL cambie también
                let _ = ws.send(FrameType::Text(false), 
                    json!({"type": "led_update", "color": color, "state": state}).to_string().as_bytes()
                );
            }

            // --- CASO 2: VALIDACIÓN QR (Desde Celular/Web) ---
            else if msg.msg_type == "auth_qr" {
                let code = msg.payload.get("code").and_then(|v| v.as_str()).unwrap_or("");
                
                // Si el QR es válido (solo números según tu regla)
                if code.chars().all(char::is_numeric) && !code.is_empty() {
                    cambiar_led(&shared_leds, "green", true);
                    let _ = ws.send(FrameType::Text(false), json!({"type": "led_update", "color": "green", "state": "on"}).to_string().as_bytes());
                    
                    std::thread::sleep(std::time::Duration::from_millis(800));
                    let _ = ws.send(FrameType::Text(false), json!({"type": "auth_success"}).to_string().as_bytes());
                    
                    cambiar_led(&shared_leds, "green", false);
                    let _ = ws.send(FrameType::Text(false), json!({"type": "led_update", "color": "green", "state": "off"}).to_string().as_bytes());
                } else {
                    cambiar_led(&shared_leds, "red", true);
                    let _ = ws.send(FrameType::Text(false), json!({"type": "led_update", "color": "red", "state": "on"}).to_string().as_bytes());
                    let _ = ws.send(FrameType::Text(false), json!({"type": "auth_error"}).to_string().as_bytes());
                    
                    std::thread::sleep(std::time::Duration::from_millis(1500));
                    cambiar_led(&shared_leds, "red", false);
                    let _ = ws.send(FrameType::Text(false), json!({"type": "led_update", "color": "red", "state": "off"}).to_string().as_bytes());
                }
            }

            // --- CASO 3: PRONÓSTICO (Desde Celular/Web) ---
            else if msg.msg_type == "predict" {
                cambiar_led(&shared_leds, "blue", true);
                let _ = ws.send(FrameType::Text(false), json!({"type": "led_update", "color": "blue", "state": "on"}).to_string().as_bytes());
                
                std::thread::sleep(std::time::Duration::from_millis(1000));
                let _ = ws.send(FrameType::Text(false), json!({"type": "predict_success"}).to_string().as_bytes());
                
                cambiar_led(&shared_leds, "blue", false);
                let _ = ws.send(FrameType::Text(false), json!({"type": "led_update", "color": "blue", "state": "off"}).to_string().as_bytes());
            }
        }
        Ok::<(), esp_idf_svc::sys::EspError>(())
    })?;
    Ok(())
}

// Función auxiliar para no repetir código de LEDs
fn cambiar_led(shared_leds: &SharedLeds, color: &str, on: bool) {
    if let Ok(mut lock) = shared_leds.lock() {
        if let Some(leds) = lock.as_mut() {
            leds.turn_off_all();
            if on {
                match color {
                    "green" => { let _ = leds.green.set_high(); },
                    "red" => { let _ = leds.red.set_high(); },
                    "blue" => { let _ = leds.blue.set_high(); },
                    _ => {}
                }
            }
        }
    }
}