const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    id_result: {
        type: Number,
        required: true
    },
    id_network: {
        type: Number,
        required: true
    },
    id_project: {
        type: Number,
        required: true
    },
    classes_result: [{
        type: mongoose.Schema.Types.Mixed
    }],
    global_result: [{
        type: mongoose.Schema.Types.Mixed
    }],
    headers_result: [{
        type: mongoose.Schema.Types.Mixed
    }],
    modules_result: [{
        type: mongoose.Schema.Types.Mixed
    }],
    objects_result: [{
        type: mongoose.Schema.Types.Mixed
    }],
    schedules_result: [{
        type: mongoose.Schema.Types.Mixed
    }],
    types_result: [{
        type: mongoose.Schema.Types.Mixed
    }], 
    version_result: [{
        type: mongoose.Schema.Types.Mixed
    }]
});

const Result = mongoose.model('Result', resultSchema);

module.exports = Result;
