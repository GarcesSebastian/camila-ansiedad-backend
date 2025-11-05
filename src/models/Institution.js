const mongoose = require('mongoose');
const validator = require('validator');

const institutionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'El nombre de la institución es requerido'],
        trim: true,
        unique: true
    },
    type: {
        type: String,
        enum: ['university', 'school', 'company', 'health_center'],
        required: true
    },
    contactEmail: {
        type: String,
        required: true,
        validate: [validator.isEmail, 'Por favor ingresa un email válido']
    },
    phone: {
        type: String,
        trim: true
    },
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String
    },
    logo: {
        type: String // URL del logo
    },
    isActive: {
        type: Boolean,
        default: true
    },
    settings: {
        maxUsers: { type: Number, default: 100 },
        institutionCode: { type: String, required: true, unique: true },
        customFields: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true // Agrega createdAt y updatedAt automáticamente
});

// Middleware para actualizar updatedAt antes de guardar
institutionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Institution', institutionSchema);