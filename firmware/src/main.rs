pub mod hardware;
pub mod web;
pub mod wifi;

use esp_idf_svc::eventloop::EspSystemEventLoop;
use esp_idf_svc::hal::peripherals::Peripherals;
use esp_idf_svc::nvs::{EspDefaultNvsPartition, EspNvs};
use std::sync::{Arc, Mutex};

use wifi::init::start_wifi;
use wifi::manager::start_wifi_manager;
use wifi::mdns::start_mdns;
use wifi::scanner;

use hardware::leds::{SystemLeds, SharedLeds};
use hardware::keypad::{start_keypad_service, KeyEvent};

fn main() {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    let peripherals = Peripherals::take().unwrap();
    let sysloop = EspSystemEventLoop::take().expect("Error EventLoop");
    let nvs_partition = EspDefaultNvsPartition::take().expect("Error NVS");

    // 1. Inicializar WiFi y mDNS
    let wifi_handle = start_wifi(peripherals.modem, sysloop.clone(), nvs_partition.clone()).expect("Error WiFi");
    let _mdns = start_mdns().expect("Error mDNS");
    start_wifi_manager(wifi_handle.clone(), nvs_partition.clone());

    let scan_state = scanner::new_scan_state();

    // 2. Estado Compartido para Hardware
    let keypad_buf = Arc::new(Mutex::new(Vec::<KeyEvent>::new()));
    let shared_leds: SharedLeds = Arc::new(Mutex::new(None));

    // 3. Leer Configuración Hardware desde NVS (LEDs)
    if let Ok(nvs) = EspNvs::new(nvs_partition.clone(), "hw_cfg", true) {
        let mut buf = vec![0; 1024];
        if let Ok(Some(json_str)) = nvs.get_str("pins", &mut buf) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                let led_g = parsed.get("led_g").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                let led_r = parsed.get("led_r").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                let led_b = parsed.get("led_b").and_then(|v| v.as_u64()).unwrap_or(0) as u32;

                if led_g > 0 && led_r > 0 && led_b > 0 {
                    match SystemLeds::new(led_g, led_r, led_b) {
                        Ok(leds) => {
                            *shared_leds.lock().unwrap() = Some(leds);
                            log::info!("LEDs inicializados correctamente.");
                        }
                        Err(e) => {
                            log::error!("No se pudieron inicializar los LEDs con los pines configurados: {e}");
                        }
                    }
                }
            }
        }
    }

    // 4. Iniciar Servicio del Teclado Matricial (Hilo Secundario)
    start_keypad_service(nvs_partition.clone(), keypad_buf.clone());

    // 5. Iniciar Servidor Web
    let _server = web::server::start_web(
        wifi_handle.clone(),
        nvs_partition.clone(),
        scan_state,
        keypad_buf.clone(),
        shared_leds.clone()
    ).expect("Error Servidor");

    log::info!("🚀 Sistema FIFA 2026 ONLINE");

    // Loop principal
    loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
    }
}