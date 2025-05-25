const math = require('mathjs');

function parseComplexToPolar(inputString) {
    // Eliminar espacios y posibles unidades al final (por ejemplo, " V")
    let cleaned = inputString.trim().replace(/\s+[a-zA-Z]+$/, '');
    // Reemplazar "j" por "i" para que math.js lo entienda
    cleaned = cleaned.replace(/j/gi, 'i');
    console.log("Cadena limpia:", cleaned);
    
    let complexNum;
    try {
        complexNum = math.complex(cleaned);
    } catch (error) {
        console.error("Error al convertir la cadena a número complejo:", error);
        return null;
    }

    const r = math.abs(complexNum);
    const theta = math.arg(complexNum) * 180 / Math.PI;  // Ángulo en radianes

    return { r, theta };
}


module.exports = { parseComplexToPolar };