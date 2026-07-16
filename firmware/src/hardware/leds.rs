use esp_idf_svc::hal::gpio::*;
use std::sync::{Arc, Mutex};

pub struct SystemLeds {
    pub green: PinDriver<'static, Output>,
    pub red: PinDriver<'static, Output>,
    pub blue: PinDriver<'static, Output>,
}

impl SystemLeds {
    pub fn new(g: u32, r: u32, b: u32) -> Result<Self, anyhow::Error> {
        let p_g = unsafe { AnyIOPin::steal(g as u8) };
        let p_r = unsafe { AnyIOPin::steal(r as u8) };
        let p_b = unsafe { AnyIOPin::steal(b as u8) };

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