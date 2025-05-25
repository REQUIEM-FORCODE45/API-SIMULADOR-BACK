const mongoose = require('mongoose');

const networkGlmSchema = new mongoose.Schema({
    id_project: {
        type: String,
    },
    id_user: {
        type: String,
    },
    id_network: {
        type: String,
        required: true
    },
    glm: {
        type: String,
        required: true
    },

});

const NetworkGlm = mongoose.model('NetworkGlm', networkGlmSchema);

module.exports = NetworkGlm;