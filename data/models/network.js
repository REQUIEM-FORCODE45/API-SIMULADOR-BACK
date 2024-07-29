const mongoose = require('mongoose');
const moduleSchema = new mongoose.Schema({  
    attributes: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    name: { type: String, required: true }}, 
    { _id: false });

    const networkSchema = new mongoose.Schema({
        id_network: {
            type: String,
        },
        network_name: {
            type: String,
            required: true
        },
        application: {
            type: String,
        },
        version: {
            type: String,
        },
        modules: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        types: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        header: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        classes: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        globals: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        schedules: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        objects: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
    }, { minimize: false });

const Network = mongoose.model('Network', networkSchema);

module.exports = Network;
