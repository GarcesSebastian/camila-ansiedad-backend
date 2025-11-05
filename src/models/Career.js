const mongoose = require('mongoose');

const careerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'El nombre de la carrera es requerido'],
        trim: true
    },
    code: {
        type: String, // Código único de la carrera
        trim: true
    },
    institution: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institution',
        required: true
    },
    faculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Faculty',
        required: true
    },
    program: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Program',
        required: true
    },
    semesters: [{
        number: { type: Number, required: true },
        name: { type: String, required: true }, // "Primer Semestre"
        courses: [{
            name: String,
            code: String,
            credits: Number
        }]
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Career', careerSchema);