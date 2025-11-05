const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'El nombre de la facultad es requerido'],
        trim: true
    },
    institution: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institution',
        required: true
    },
    dean: {
        type: String, // Nombre del decano
        trim: true
    },
    contactEmail: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Faculty', facultySchema);