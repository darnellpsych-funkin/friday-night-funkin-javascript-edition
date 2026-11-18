// Lógica de juicio de notas (Sick / Good / Bad / Shit / Fallo) escrita en Rust.
// Se compila a WebAssembly y el juego en TypeScript la llama.
// Sin dependencias: se exportan funciones simples que reciben y devuelven números.

/// Ventanas de juicio en milisegundos, igual que en gameplay.ts.
const MAX_MS: [f64; 4] = [45.0, 90.0, 135.0, 166.0];
const POINTS: [i32; 4] = [350, 200, 100, 50];
const WEIGHT: [f64; 4] = [1.0, 0.8, 0.5, 0.25];

/// Devuelve el índice del juicio para una diferencia absoluta en ms:
/// 0 = Sick, 1 = Good, 2 = Bad, 3 = Shit, 4 = fuera de ventana (Fallo).
#[unsafe(no_mangle)]
pub extern "C" fn judge(diff_ms: f64) -> i32 {
    let diff = diff_ms.abs();
    for (i, max) in MAX_MS.iter().enumerate() {
        if diff <= *max {
            return i as i32;
        }
    }
    4
}

/// Puntos base de un juicio (0..3). Para 4 o más devuelve 0.
#[unsafe(no_mangle)]
pub extern "C" fn rating_points(rating: i32) -> i32 {
    if (0..4).contains(&rating) { POINTS[rating as usize] } else { 0 }
}

/// Peso del juicio para la precisión (0..3). Para otro valor devuelve 0.
#[unsafe(no_mangle)]
pub extern "C" fn rating_weight(rating: i32) -> f64 {
    if (0..4).contains(&rating) { WEIGHT[rating as usize] } else { 0.0 }
}
