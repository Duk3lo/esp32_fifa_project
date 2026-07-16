use esp_idf_svc::hal::gpio::*;
use esp_idf_svc::nvs::{EspDefaultNvsPartition, EspNvs};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::thread;

pub struct KeypadScanner {
    rows: Vec<PinDriver<'static, Output>>, 
    cols: Vec<PinDriver<'static, Input>>,
    matrix: [[char; 4]; 4],
}

impl KeypadScanner {
    pub fn new(row_pins: Vec<AnyIOPin<'static>>, col_pins: Vec<AnyIOPin<'static>>) -> Result<Self, anyhow::Error> {
        let mut rows = Vec::new();
        for pin in row_pins {
            let mut driver = PinDriver::output(pin)?;
            driver.set_high()?;
            rows.push(driver);
        }

        let mut cols = Vec::new();
        for pin in col_pins {
            let driver = PinDriver::input(pin, Pull::Up)?;
            cols.push(driver);
        }

        let matrix = [
            ['1', '2', '3', 'A'],
            ['4', '5', '6', 'B'],
            ['7', '8', '9', 'C'],
            ['*', '0', '#', 'D'],
        ];

        Ok(Self { rows, cols, matrix })
    }

    pub fn scan(&mut self) -> Option<char> {
        for r in 0..self.rows.len() {
            let _ = self.rows[r].set_low();
            thread::sleep(Duration::from_micros(200));

            for c in 0..self.cols.len() {
                if self.cols[c].is_low() {
                    let _ = self.rows[r].set_high();
                    return Some(self.matrix[r][c]);
                }
            }
            let _ = self.rows[r].set_high();
        }
        None
    }
}

fn get_any_pin(pin_num: u32) -> Option<AnyIOPin<'static>> {
    match pin_num {
        0 | 2 | 4 | 5 | 12..=19 | 21..=23 | 25..=27 | 32 | 33 => {
            Some(unsafe { AnyIOPin::steal(pin_num as u8) })
        },
        _ => None,
    }
}

pub fn start_keypad_service(
    nvs_partition: EspDefaultNvsPartition,
    keypad_buf: Arc<Mutex<Vec<char>>>,
) {
    thread::spawn(move || {
        let mut filas_str = String::new();
        let mut cols_str = String::new();

        if let Ok(nvs) = EspNvs::new(nvs_partition, "hw_cfg", true) {
            let mut buf = vec![0; 1024];
            if let Ok(Some(json_str)) = nvs.get_str("pins", &mut buf) {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                    filas_str = parsed.get("filas").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    cols_str = parsed.get("cols").and_then(|v| v.as_str()).unwrap_or("").to_string();
                }
            }
        }

        if filas_str.is_empty() || cols_str.is_empty() { return; }

        let row_pins: Vec<AnyIOPin<'static>> = filas_str.split(',')
            .filter_map(|s| s.trim().parse::<u32>().ok())
            .filter_map(|num| get_any_pin(num))
            .collect();

        let col_pins: Vec<AnyIOPin<'static>> = cols_str.split(',')
            .filter_map(|s| s.trim().parse::<u32>().ok())
            .filter_map(|num| get_any_pin(num))
            .collect();

        if let Ok(mut scanner) = KeypadScanner::new(row_pins, col_pins) {
            log::info!("Teclado matricial iniciado.");
            let mut last_key = None;

            loop {
                if let Some(key) = scanner.scan() {
                    if last_key != Some(key) {
                        if let Ok(mut buf) = keypad_buf.lock() {
                            buf.push(key);
                        }
                        last_key = Some(key);
                    }
                } else {
                    last_key = None;
                }
                thread::sleep(Duration::from_millis(50));
            }
        }
    });
}