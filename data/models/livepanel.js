const mongoose = require('mongoose');

const livePanelSchema = new mongoose.Schema({
    v: { type: Number },
    c: { type: Number },
    p: { type: Number },
    e: { type: Number },
    f: { type: Number },
    pf: { type: Number },
    timestamp: { type: Date, default: Date.now } // Fecha y hora de inserción
});

// Crear los tres modelos
const s1_Livepanel = mongoose.model('s1_Livepanel', livePanelSchema);
const s2_Livepanel = mongoose.model('s2_Livepanel', livePanelSchema);
const s3_Livepanel = mongoose.model('s3_Livepanel', livePanelSchema);

// Exportarlos todos
module.exports = {
    s1_Livepanel,
    s2_Livepanel,
    s3_Livepanel
};
