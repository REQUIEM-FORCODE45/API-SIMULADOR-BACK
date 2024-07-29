const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    id_project: {
        type: String,
    },
    id_network: {
        type: String,
        required: true
    },
    project_name: {
        type: String,
        required: true
    },
    description: {
        type: String
    }
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
