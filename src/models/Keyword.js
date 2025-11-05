const mongoose = require('mongoose');

const keywordSchema = new mongoose.Schema({
    symptom: {
        type: String,
        required: [true, 'El síntoma es requerido'],
        enum: ['ansiedad', 'depresion', 'insomnio', 'estres', 'panico', 'otros'],
        default: 'ansiedad'
    },
    keyword: {
        type: String,
        required: [true, 'La palabra clave es requerida'],
        trim: true,
        lowercase: true
    },
    weight: {
        type: Number,
        required: [true, 'El peso es requerido'],
        min: [1, 'El peso mínimo es 1'],
        max: [5, 'El peso máximo es 5'],
        default: 3
    },
    expertId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    institution: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institution',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Índices para mejor performance
keywordSchema.index({ expertId: 1 });
keywordSchema.index({ institution: 1 });
keywordSchema.index({ symptom: 1 });
keywordSchema.index({ keyword: 1 });
keywordSchema.index({ isActive: 1 });
keywordSchema.index({ weight: -1 });

// Evitar duplicados por experto
keywordSchema.index({ 
    expertId: 1, 
    keyword: 1, 
    symptom: 1 
}, { 
    unique: true,
    partialFilterExpression: { isActive: true }
});

// Método estático para buscar palabras clave por institución
keywordSchema.statics.findByInstitution = function(institutionId, symptom = null) {
    const query = { 
        institution: institutionId, 
        isActive: true 
    };
    
    if (symptom) query.symptom = symptom;
    
    return this.find(query)
        .populate('expertId', 'name email')
        .sort({ weight: -1, createdAt: -1 });
};

// Método estático para obtener palabras clave de un experto
keywordSchema.statics.findByExpert = function(expertId, symptom = null) {
    const query = { 
        expertId: expertId, 
        isActive: true 
    };
    
    if (symptom) query.symptom = symptom;
    
    return this.find(query).sort({ weight: -1, createdAt: -1 });
};

module.exports = mongoose.model('Keyword', keywordSchema);