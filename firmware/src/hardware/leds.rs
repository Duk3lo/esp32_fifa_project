use esp_idf_svc::hal::gpio::*;
use std::sync::{Arc, Mutex};
use crate::hardware::pins::get_any_pin;

pub struct SystemLeds {
    pub green: PinDriver<'static, Output>,
    pub red: PinDriver<'static, Output>,
    pub blue: PinDriver<'static, Output>,
    pub orange: PinDriver<'static, Output>,
}

impl SystemLeds {
    pub fn new(g: u32, r: u32, b: u32, o: u32) -> Result<Self, anyhow::Error> {
        let p_g = get_any_pin(g).ok_or_else(|| anyhow::anyhow!("Pin inválido para verde"))?;
        let p_r = get_any_pin(r).ok_or_else(|| anyhow::anyhow!("Pin inválido para rojo"))?;
        let p_b = get_any_pin(b).ok_or_else(|| anyhow::anyhow!("Pin inválido para azul"))?;
        let p_o = get_any_pin(o).ok_or_else(|| anyhow::anyhow!("Pin inválido para naranja"))?;

        let mut green = PinDriver::output(p_g)?;
        let mut red = PinDriver::output(p_r)?;
        let mut blue = PinDriver::output(p_b)?;
        let mut orange = PinDriver::output(p_o)?;

        let _ = green.set_low();
        let _ = red.set_low();
        let _ = blue.set_low();
        let _ = orange.set_low();

        Ok(Self { green, red, blue, orange })
    }

    pub fn turn_off_all(&mut self) {
        let _ = self.green.set_low();
        let _ = self.red.set_low();
        let _ = self.blue.set_low();
        let _ = self.orange.set_low();
    }
}

pub type SharedLeds = Arc<Mutex<Option<SystemLeds>>>;