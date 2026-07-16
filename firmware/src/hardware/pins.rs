use esp_idf_svc::hal::gpio::AnyIOPin;


pub fn is_safe_gpio(pin_num: u32) -> bool {
    matches!(pin_num, 0 | 2 | 4 | 5 | 12..=19 | 21..=23 | 25..=27 | 32 | 33)
}

pub fn get_any_pin(pin_num: u32) -> Option<AnyIOPin<'static>> {
    if is_safe_gpio(pin_num) {
        Some(unsafe { AnyIOPin::steal(pin_num as u8) })
    } else {
        None
    }
}