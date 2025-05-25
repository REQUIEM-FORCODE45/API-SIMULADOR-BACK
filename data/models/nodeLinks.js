const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
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
    nodes: {
        type: mongoose.Schema.Types.Mixed,
        default: []
    },
    links: {
        type: mongoose.Schema.Types.Mixed,
        default: []
    }
});

const NodeLink = mongoose.model('nodeLink', projectSchema);

module.exports = NodeLink;
