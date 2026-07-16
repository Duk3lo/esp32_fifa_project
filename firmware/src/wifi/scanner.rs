use crate::wifi::init::SharedWifi;
use anyhow::{anyhow, Result};
use serde::Serialize;
use std::sync::{Arc, Mutex};

#[derive(Serialize, Clone)]
pub struct WifiNetwork {
    pub ssid: String,
    pub bssid: String,
    pub rssi: i8,
    pub auth_method: String,
}

#[derive(Clone)]
pub enum ScanState {
    Idle,
    Scanning,
    Done(Vec<WifiNetwork>),
    Error(String),
}

pub type SharedScanState = Arc<Mutex<ScanState>>;

pub fn new_scan_state() -> SharedScanState {
    Arc::new(Mutex::new(ScanState::Idle))
}

pub fn scan_networks_blocking(wifi: SharedWifi) -> Result<Vec<WifiNetwork>> {
    let mut wifi_lock = wifi.lock().map_err(|_| anyhow!("WiFi lock envenenado"))?;
    let ap_infos = wifi_lock.scan()?;
    let mut networks = Vec::new();

    for ap in ap_infos {
        let b = ap.bssid;
        let bssid_str = format!(
            "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
            b[0], b[1], b[2], b[3], b[4], b[5]
        );
        let auth_str = format!("{:?}", ap.auth_method).replace("\"", "");

        networks.push(WifiNetwork {
            ssid: ap.ssid.to_string(),
            bssid: bssid_str,
            rssi: ap.signal_strength,
            auth_method: auth_str,
        });
    }

    Ok(networks)
}

pub fn start_scan_async(wifi: SharedWifi, scan_state: SharedScanState) -> Result<()> {
    {
        let mut state = scan_state.lock().unwrap();
        if let ScanState::Scanning = *state {
            return Err(anyhow!("Ya hay un escaneo en curso"));
        }
        *state = ScanState::Scanning;
    }

    let state_clone = scan_state.clone();
    std::thread::Builder::new()
        .stack_size(8192)
        .spawn(move || {
            let result = scan_networks_blocking(wifi);
            let mut state = state_clone.lock().unwrap();
            *state = match result {
                Ok(networks) => ScanState::Done(networks),
                Err(e) => ScanState::Error(e.to_string()),
            };
        })
        .map_err(|_| anyhow!("No se pudo iniciar el hilo de escaneo"))?;

    Ok(())
}

pub fn poll_scan_state(scan_state: &SharedScanState) -> ScanState {
    let mut state = scan_state.lock().unwrap();
    let current = state.clone();
    if matches!(*state, ScanState::Done(_) | ScanState::Error(_)) {
        *state = ScanState::Idle;
    }
    current
}