const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
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
    recommendation: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'dismissed'],
        default: 'pending'
    },
    followUpDate: Date,
    category: {
        type: String,
        enum: ['psychological', 'academic', 'lifestyle', 'medical', 'other'],
        default: 'psychological'
    },
    actions: [{
        description: String,
        completed: {
            type: Boolean,
            default: false
        },
        dueDate: Date,
        completedAt: Date
    }],
    userNotes: String,
    expertNotes: String,
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
recommendationSchema.index({ userId: 1 });
recommendationSchema.index({ expertId: 1 });
recommendationSchema.index({ institution: 1 });
recommendationSchema.index({ status: 1 });
recommendationSchema.index({ priority: 1 });
recommendationSchema.index({ category: 1 });
recommendationSchema.index({ isActive: 1 });
recommendationSchema.index({ createdAt: -1 });
recommendationSchema.index({ followUpDate: 1 });

// Método para obtener recomendaciones activas por usuario
recommendationSchema.statics.findActiveByUser = function(userId) {
    return this.find({ 
        userId, 
        isActive: true,
        status: { $in: ['pending', 'in_progress'] }
    }).populate('expertId', 'name email').sort({ priority: -1, createdAt: -1 });
};

// Método para obtener recomendaciones por experto
recommendationSchema.statics.findByExpert = function(expertId, status = null) {
    const query = { expertId, isActive: true };
    if (status) query.status = status;
    
    return this.find(query)
        .populate('userId', 'name email institutionalPath')
        .sort({ priority: -1, createdAt: -1 });
};

// Método para actualizar estado
recommendationSchema.methods.updateStatus = function(newStatus, notes = '') {
    this.status = newStatus;
    this.updatedAt = new Date();
    if (notes) {
        this.expertNotes = notes;
    }
    return this.save();
};

// Método para agregar acción
recommendationSchema.methods.addAction = function(description, dueDate = null) {
    this.actions.push({
        description,
        dueDate,
        completed: false
    });
    return this.save();
};

// Método para completar acción
recommendationSchema.methods.completeAction = function(actionIndex) {
    if (this.actions[actionIndex]) {
        this.actions[actionIndex].completed = true;
        this.actions[actionIndex].completedAt = new Date();
    }
    return this.save();
};

// Virtual para verificar si está vencida
recommendationSchema.virtual('isOverdue').get(function() {
    if (!this.followUpDate) return false;
    return new Date() > this.followUpDate && this.status !== 'completed';
});

// Middleware para actualizar updatedAt antes de guardar
recommendationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Recommendation', recommendationSchema);