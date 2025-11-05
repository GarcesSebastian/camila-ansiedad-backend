const mongoose = require('mongoose');

const programSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'El nombre del programa es requerido'],
        trim: true
    },
    institution: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institution',
        required: true
    },
    type: {
    type: String,
    enum: ['undergraduate', 'graduate', 'postgraduate', 'diploma'], // Ejemplo de valores
    required: true
},
    description: {
        type: String,
        default: 'academic',
        trim: true
    },
    duration: {
        type: String // "4 años", "6 semestres"
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

module.exports = mongoose.model('Program', programSchema);