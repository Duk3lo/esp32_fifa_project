use esp_idf_svc::nvs::{EspDefaultNvsPartition, EspNvs};
use esp_idf_svc::wifi::{AccessPointConfiguration, AuthMethod};
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Serialize, Deserialize, Debug)]
pub struct SavedNetwork {
    pub ssid: String,
    pub pass: String,
    pub auth_type: String,
    pub user: Option<String>,
    pub anon_identity: Option<String>,
    pub eap_method: Option<String>,
    pub phase2: Option<String>,
}

pub fn get_saved_networks(nvs_partition: &EspDefaultNvsPartition) -> Result<Vec<SavedNetwork>> {
    let nvs = EspNvs::new(nvs_partition.clone(), "wifi_data", true)?;
    let mut buffer = vec![0u8; 4096];
    match nvs.get_str("networks", &mut buffer)? {
        Some(json_str) => Ok(serde_json::from_str(json_str).unwrap_or_default()),
        _ => Ok(Vec::new()),
    }
}

pub fn save_network(nvs_partition: &EspDefaultNvsPartition, network: SavedNetwork) -> Result<()> {
    let mut nets = get_saved_networks(nvs_partition)?;
    nets.retain(|n| n.ssid != network.ssid);
    nets.push(network);
    let json_str = serde_json::to_string(&nets)?;
    let nvs = EspNvs::new(nvs_partition.clone(), "wifi_data", true)?;
    nvs.set_str("networks", &json_str)?;
    Ok(())
}

pub fn delete_network(nvs_partition: &EspDefaultNvsPartition, ssid: &str) -> Result<()> {
    let mut nets = get_saved_networks(nvs_partition)?;
    let original_len = nets.len();
    nets.retain(|n| n.ssid != ssid);

    if nets.len() < original_len {
        let json_str = serde_json::to_string(&nets)?;
        let nvs = EspNvs::new(nvs_partition.clone(), "wifi_data", true)?;
        nvs.set_str("networks", &json_str)?;
    }
    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ApConfig {
    pub ssid: String,
    pub pass: String,
    pub open: bool,
}

impl Default for ApConfig {
    fn default() -> Self {
        Self {
            ssid: "ESP32-SETUP".to_string(),
            pass: "12345678".to_string(),
            open: false,
        }
    }
}

pub fn get_ap_config(nvs_partition: &EspDefaultNvsPartition) -> Result<ApConfig> {
    let nvs = EspNvs::new(nvs_partition.clone(), "wifi_data", true)?;
    let mut buffer = vec![0u8; 512];
    match nvs.get_str("ap_config", &mut buffer)? {
        Some(json_str) => Ok(serde_json::from_str(json_str).unwrap_or_default()),
        _ => Ok(ApConfig::default()),
    }
}

pub fn save_ap_config(nvs_partition: &EspDefaultNvsPartition, config: &ApConfig) -> Result<()> {
    let json_str = serde_json::to_string(config)?;
    let nvs = EspNvs::new(nvs_partition.clone(), "wifi_data", true)?;
    nvs.set_str("ap_config", &json_str)?;
    Ok(())
}

/// Construye la configuración del punto de acceso (softAP) a partir de lo
/// guardado en NVS. Centraliza lo que antes estaba duplicado en init.rs,
/// connection.rs y manager.rs, y además protege contra el warning
/// "Password length is zero, but authmode threshold is 3...": si la
/// contraseña guardada tiene menos de 8 caracteres (mínimo que exige
/// WPA2), se cae a red abierta en vez de mandar una contraseña inválida.
pub fn build_ap_config(nvs_partition: &EspDefaultNvsPartition) -> AccessPointConfiguration<'static> {
    let ap_saved = get_ap_config(nvs_partition).unwrap_or_default();
    let mut ap_config = AccessPointConfiguration::default();
    ap_config.ssid = ap_saved.ssid.as_str().try_into().unwrap_or_default();
    ap_config.max_connections = 4;

    if ap_saved.open || ap_saved.pass.len() < 8 {
        ap_config.auth_method = AuthMethod::None;
    } else {
        ap_config.password = ap_saved.pass.as_str().try_into().unwrap_or_default();
        ap_config.auth_method = AuthMethod::WPA2Personal;
    }

    ap_config
}