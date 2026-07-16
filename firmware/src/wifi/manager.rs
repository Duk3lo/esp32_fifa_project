use super::init::SharedWifi;
use super::storage::get_saved_networks;
use super::scanner;
use super::connection;
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use esp_idf_svc::wifi::{AccessPointConfiguration, AuthMethod, ClientConfiguration, Configuration};
use std::thread;
use std::time::Duration;

pub fn start_wifi_manager(wifi: SharedWifi, nvs_partition: EspDefaultNvsPartition) {
    thread::Builder::new()
        .stack_size(8192)
        .spawn(move || {
            thread::sleep(Duration::from_secs(15)); 
            
            loop {
                let is_connected = wifi.lock().map(|w| w.is_connected().unwrap_or(false)).unwrap_or(false);
                
                if !is_connected {
                    if let Ok(mut lock) = wifi.lock() {
                        if let Ok(config) = lock.get_configuration() {
                            if matches!(config, Configuration::Client(_)) {
                                let ap_saved = super::storage::get_ap_config(&nvs_partition).unwrap_or_default();
                                let mut ap_config = AccessPointConfiguration::default();
                                ap_config.ssid = ap_saved.ssid.as_str().try_into().unwrap_or_default();
                                if ap_saved.open { ap_config.auth_method = AuthMethod::None; } else {
                                    ap_config.password = ap_saved.pass.as_str().try_into().unwrap_or_default();
                                    ap_config.auth_method = AuthMethod::WPA2Personal;
                                }
                                let _ = lock.set_configuration(&Configuration::Mixed(ClientConfiguration::default(), ap_config));
                                println!("Red Wi-Fi perdida. Punto de acceso habilitado de nuevo.");
                            }
                        }
                    }
                    let saved_networks = get_saved_networks(&nvs_partition).unwrap_or_default();
                    if !saved_networks.is_empty() {
                        if let Ok(available) = scanner::scan_networks_blocking(wifi.clone()) {
                            let mut se_conecto = false;
                            for saved in saved_networks.into_iter() {
                                if available.iter().any(|n| n.ssid == saved.ssid) {
                                    let req = connection::ConnectRequest {
                                        ssid: saved.ssid.clone(), pass: saved.pass.clone(), auth_type: saved.auth_type.clone(),
                                        user: saved.user.clone(), anon_identity: saved.anon_identity.clone(), eap_method: saved.eap_method.clone(), phase2: saved.phase2.clone(),
                                    };
                                    if connection::connect_to_wifi(wifi.clone(), &nvs_partition, req).is_ok() {
                                        se_conecto = true;
                                        break;
                                    }
                                }
                            }
                            if se_conecto {
                                thread::sleep(Duration::from_secs(60));
                                continue;
                            }
                        }
                    }
                    thread::sleep(Duration::from_secs(30));
                } else {
                    thread::sleep(Duration::from_secs(60));
                }
            }
        })
        .expect("Error al iniciar el hilo del gestor WiFi");
}