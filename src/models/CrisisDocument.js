const mongoose = require('mongoose');

const crisisDocumentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'El título es requerido'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'La descripción es requerida']
    },
    fileName: {
        type: String,
        required: [true, 'El nombre del archivo es requerido']
    },
    filePath: {
        type: String,
        required: [true, 'La ruta del archivo es requerida']
    },
    fileSize: {
        type: Number,
        required: true
    },
    fileType: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['protocolo', 'guia', 'recurso', 'formulario', 'otros'],
        default: 'protocolo'
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
    downloadCount: {
        type: Number,
        default: 0
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

// Índices
crisisDocumentSchema.index({ expertId: 1 });
crisisDocumentSchema.index({ institution: 1 });
crisisDocumentSchema.index({ category: 1 });
crisisDocumentSchema.index({ isActive: 1 });
crisisDocumentSchema.index({ createdAt: -1 });

// Método estático para buscar documentos por institución
crisisDocumentSchema.statics.findByInstitution = function(institutionId, category = null) {
    const query = { 
        institution: institutionId, 
        isActive: true 
    };
    
    if (category) query.category = category;
    
    return this.find(query)
        .populate('expertId', 'name email')
        .sort({ createdAt: -1 });
};

// Método para incrementar contador de descargas
crisisDocumentSchema.methods.incrementDownloadCount = function() {
    this.downloadCount += 1;
    return this.save();
};

module.exports = mongoose.model('CrisisDocument', crisisDocumentSchema);