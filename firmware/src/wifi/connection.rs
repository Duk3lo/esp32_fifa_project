use crate::wifi::init::SharedWifi;
use crate::wifi::storage;
use anyhow::Result;
use esp_idf_svc::wifi::{AuthMethod, ClientConfiguration, Configuration};
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use serde::Deserialize;

#[allow(dead_code)]
#[derive(Deserialize, Debug, Clone)]
pub struct ConnectRequest {
    pub ssid: String,
    pub pass: String,
    pub auth_type: String,
    pub user: Option<String>,
    pub anon_identity: Option<String>,
    pub eap_method: Option<String>,
    pub phase2: Option<String>,
}

pub fn connect_to_wifi(wifi: SharedWifi, nvs: &EspDefaultNvsPartition, req: ConnectRequest) -> Result<()> {
    let mut wifi_lock = wifi.lock().unwrap();
    let current_config = wifi_lock.get_configuration()?;
    let prev_config = current_config.clone();
    let ap_config = match current_config {
        Configuration::Mixed(_, ap) | Configuration::AccessPoint(ap) => ap,
        _ => storage::build_ap_config(nvs),
    };

    let mut client_config = ClientConfiguration::default();
    client_config.ssid = req.ssid.as_str().try_into().map_err(|_| anyhow::anyhow!("SSID demasiado largo"))?;
    client_config.password = req.pass.as_str().try_into().map_err(|_| anyhow::anyhow!("Contraseña demasiado larga"))?;

    if req.auth_type.contains("Enterprise") { client_config.auth_method = AuthMethod::WPA2Enterprise; }
    else if req.pass.is_empty() || req.auth_type == "None" || req.auth_type == "Open" { client_config.auth_method = AuthMethod::None; }
    else { client_config.auth_method = AuthMethod::WPA2Personal; }
    wifi_lock.set_configuration(&Configuration::Mixed(client_config, ap_config))?;
    std::thread::sleep(std::time::Duration::from_millis(150));

    match wifi_lock.connect() {
        Ok(_) => {
            let wifi_clone = wifi.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(5));
                if let Ok(mut lock) = wifi_clone.lock() {
                    if lock.is_connected().unwrap_or(false) {
                        if let Ok(Configuration::Mixed(client, _)) = lock.get_configuration() {
                            let _ = lock.set_configuration(&Configuration::Client(client));
                            println!("Conexión a internet exitosa. AP apagado automáticamente.");
                        }
                    } else {
                        let _ = lock.set_configuration(&prev_config);
                        let _ = lock.connect();
                    }
                }
            });
            Ok(())
        },
        Err(e) => {
            let _ = wifi_lock.set_configuration(&prev_config);
            let _ = wifi_lock.connect();
            Err(anyhow::anyhow!("Error al intentar conectar: {}", e))
        }
    }
}