const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// ✅ CORREGIDO: Schema completo con soporte para usuarios anónimos
const chatSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // ✅ CAMBIADO: Permitir null para usuarios anónimos
    },
    anonymousId: {
        type: String,
        required: function() {
            return !this.user; // ✅ Requerido solo si no hay user (anónimos)
        },
        sparse: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    messages: [messageSchema],
    riskLevel: {
        type: String,
        enum: ['critico', 'alto', 'medio', 'bajo', 'minimo', null],
        default: null
    },
    riskScore: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    anxietyIndicators: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    lastRiskAssessment: {
        type: Date,
        default: null
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    institution: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institution'
    },
    analysis: {
        traditional: {
            riskLevel: String,
            riskScore: Number,
            indicators: mongoose.Schema.Types.Mixed
        },
        keywordAnalysis: {
            riskLevel: String,
            riskScore: Number,
            detectedKeywords: [{
                keyword: String,
                symptom: String,
                weight: Number,
                context: String,
                exactMatch: Boolean
            }],
            summary: String,
            totalWeight: Number,
            weightPercentage: Number
        },
        contextualAnalysis: {
            riskAssessment: {
                level: String,
                score: Number,
                confidence: Number
            },
            emotionalContext: String,
            keyConcerns: [String],
            recommendations: [String],
            urgency: String
        }
    }
}, {
    timestamps: true
});

// Actualizar updatedAt antes de guardar
chatSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Si es un nuevo chat, establecer el título si no existe
    if (this.isNew && this.messages.length > 0) {
        const firstMessage = this.messages[0].content;
        if (firstMessage && !this.title) {
            this.title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
        }
    }
    
    // ✅ NUEVO: Determinar automáticamente si es anónimo
    if (this.isNew) {
        this.isAnonymous = !this.user && !!this.anonymousId;
    }
    
    next();
});

// Índices para mejor performance
chatSchema.index({ user: 1, createdAt: -1 });
chatSchema.index({ anonymousId: 1, createdAt: -1 });
chatSchema.index({ riskLevel: 1 });
chatSchema.index({ isActive: 1 });
chatSchema.index({ lastRiskAssessment: -1 });
chatSchema.index({ isAnonymous: 1 }); // ✅ NUEVO: Índice para búsquedas anónimas

// ✅ CORREGIDO: Método estático para obtener conteo de mensajes anónimos
chatSchema.statics.getAnonymousMessageCount = function(anonymousId) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.countDocuments({
        anonymousId: anonymousId,
        isAnonymous: true,
        createdAt: { $gte: twentyFourHoursAgo }
    });
};

// ✅ NUEVO: Método estático para buscar chats por anonymousId
chatSchema.statics.findByAnonymousId = function(anonymousId, options = {}) {
    const query = { 
        anonymousId: anonymousId, 
        isAnonymous: true,
        isActive: true 
    };
    
    if (options.riskLevel) {
        query.riskLevel = options.riskLevel;
    }
    
    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(options.limit || 50);
};

// ✅ NUEVO: Método estático para buscar chats (soporta ambos tipos)
chatSchema.statics.findChats = function(identifier, options = {}) {
    let query = { isActive: true };
    
    // Determinar si es user ID (ObjectId) o anonymousId (string)
    if (mongoose.Types.ObjectId.isValid(identifier)) {
        query.user = identifier;
        query.isAnonymous = false;
    } else {
        query.anonymousId = identifier;
        query.isAnonymous = true;
    }
    
    if (options.riskLevel) {
        query.riskLevel = options.riskLevel;
    }
    
    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(options.limit || 50)
        .populate('user', 'name email')
        .populate('institution', 'name');
};

// Método de instancia para agregar mensaje
chatSchema.methods.addMessage = function(role, content) {
    this.messages.push({
        role,
        content,
        timestamp: new Date()
    });
    return this.save();
};

// Método de instancia para actualizar análisis de riesgo
chatSchema.methods.updateRiskAssessment = function(riskLevel, riskScore, indicators) {
    const validRiskLevels = ['critico', 'alto', 'medio', 'bajo', 'minimo'];
    if (riskLevel && !validRiskLevels.includes(riskLevel)) {
        throw new Error(`Nivel de riesgo inválido: ${riskLevel}`);
    }
    
    this.riskLevel = riskLevel;
    this.riskScore = riskScore;
    this.anxietyIndicators = indicators || {};
    this.lastRiskAssessment = new Date();
    return this.save();
};

// Virtual para obtener el último mensaje
chatSchema.virtual('lastMessage').get(function() {
    if (!this.messages || !Array.isArray(this.messages)) {
        return null;
    }
    return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
});

// Virtual para obtener la fecha del último mensaje
chatSchema.virtual('lastMessageDate').get(function() {
    const lastMessage = this.lastMessage;
    return lastMessage ? lastMessage.timestamp : this.createdAt;
});

// Asegurar que los virtuals se incluyan en JSON
chatSchema.set('toJSON', { 
    virtuals: true,
    transform: function(doc, ret) {
        if (ret.messages && Array.isArray(ret.messages)) {
            ret.lastMessage = ret.messages.length > 0 ? ret.messages[ret.messages.length - 1] : null;
            ret.lastMessageDate = ret.lastMessage ? ret.lastMessage.timestamp : ret.createdAt;
        } else {
            ret.lastMessage = null;
            ret.lastMessageDate = ret.createdAt;
        }
        return ret;
    }
});

chatSchema.set('toObject', { 
    virtuals: true,
    transform: function(doc, ret) {
        if (ret.messages && Array.isArray(ret.messages)) {
            ret.lastMessage = ret.messages.length > 0 ? ret.messages[ret.messages.length - 1] : null;
            ret.lastMessageDate = ret.lastMessage ? ret.lastMessage.timestamp : ret.createdAt;
        } else {
            ret.lastMessage = null;
            ret.lastMessageDate = ret.createdAt;
        }
        return ret;
    }
});

// ✅ CORREGIDO: Método estático para buscar chats por usuario (solo registrados)
chatSchema.statics.findByUser = function(userId, options = {}) {
    const query = { 
        user: userId, 
        isAnonymous: false,
        isActive: true 
    };
    
    if (options.riskLevel) {
        query.riskLevel = options.riskLevel;
    }
    
    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(options.limit || 50)
        .populate('user', 'name email')
        .populate('institution', 'name');
};

// ✅ CORREGIDO: Método estático para contar chats por usuario
chatSchema.statics.countByUser = function(userId) {
    return this.countDocuments({ 
        user: userId, 
        isAnonymous: false,
        isActive: true 
    });
};

// ✅ CORREGIDO: Método estático para obtener chats de alto riesgo
chatSchema.statics.findHighRiskChats = function(userId, days = 30) {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    
    return this.find({
        user: userId,
        isAnonymous: false,
        isActive: true,
        riskLevel: { $in: ['alto', 'critico'] },
        createdAt: { $gte: dateThreshold }
    }).sort({ riskScore: -1, createdAt: -1 });
};

// ✅ NUEVO: Método estático para limpiar chats anónimos antiguos
chatSchema.statics.cleanOldAnonymousChats = function(days = 7) {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    
    return this.deleteMany({
        isAnonymous: true,
        createdAt: { $lt: dateThreshold }
    });
};

module.exports = mongoose.model('Chat', chatSchema);