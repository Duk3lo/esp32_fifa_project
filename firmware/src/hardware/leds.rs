use esp_idf_svc::hal::gpio::*;
use std::sync::{Arc, Mutex};
use crate::hardware::pins::get_any_pin;

pub struct SystemLeds {
    pub green: PinDriver<'static, Output>,
    pub red: PinDriver<'static, Output>,
    pub blue: PinDriver<'static, Output>,
}

impl SystemLeds {
    pub fn new(g: u32, r: u32, b: u32) -> Result<Self, anyhow::Error> {
        if g == r || g == b || r == b {
            anyhow::bail!("Los pines de LED no pueden repetirse (g={g}, r={r}, b={b})");
        }

        let p_g = get_any_pin(g).ok_or_else(|| anyhow::anyhow!("Pin GPIO {g} no permitido para LED verde"))?;
        let p_r = get_any_pin(r).ok_or_else(|| anyhow::anyhow!("Pin GPIO {r} no permitido para LED rojo"))?;
        let p_b = get_any_pin(b).ok_or_else(|| anyhow::anyhow!("Pin GPIO {b} no permitido para LED azul"))?;

        let mut green = PinDriver::output(p_g)?;
        let mut red = PinDriver::output(p_r)?;
        let mut blue = PinDriver::output(p_b)?;

        let _ = green.set_low();
        let _ = red.set_low();
        let _ = blue.set_low();

        Ok(Self { green, red, blue })
    }

    pub fn turn_off_all(&mut self) {
        let _ = self.green.set_low();
        let _ = self.red.set_low();
        let _ = self.blue.set_low();
    }
}

pub type SharedLeds = Arc<Mutex<Option<SystemLeds>>>;