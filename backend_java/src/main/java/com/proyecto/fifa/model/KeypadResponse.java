package com.proyecto.fifa.model;
import java.util.List;
import lombok.Data;

@Data
public class KeypadResponse {
    private List<String> keys;
    private int last_id;

}