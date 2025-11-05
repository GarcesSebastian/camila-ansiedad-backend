const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'El email es requerido'],
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'Por favor ingresa un email válido']
    },
    password: {
        type: String,
        required: [true, 'La contraseña es requerida'],
        minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
        select: false
    },
    name: {
        type: String,
        required: [true, 'El nombre es requerido'],
        trim: true
    },
    age: {
        type: Number,
        min: [13, 'Debes tener al menos 13 años'],
        max: [120, 'Edad no válida']
    },
    role: {
        type: String,
        enum: ['superadmin', 'institutional_admin', 'expert', 'user'],
        default: 'user'
    },
    // ✅ NUEVO CAMPO: Términos y condiciones
    acceptedTerms: {
    type: Boolean,
    required: false, // ✅ CAMBIADO: No requerido para usuarios existentes
    default: false
},
    isActive: {
        type: Boolean,
        default: true
    },
    // Para expertos y usuarios institucionales
    institution: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institution'
    },
    // Para usuarios finales - su ubicación en la estructura institucional
    institutionalPath: {
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
    career: { type: mongoose.Schema.Types.ObjectId, ref: 'Career' },
    semester: { type: String }, // "2024-1", "2024-2"
    course: { type: String }, // "Matemáticas I", "Historia"
    department: { type: String }, // Para empresas
    grade: { type: String },      // Para colegios - "1", "2", "3", etc.
    section: { type: String },    // Para colegios - "A", "B", "C", etc.
    schedule: { type: String }    // Para colegios - "morning", "afternoon", etc.
},
    // Para pacientes - información específica de salud
    patientProfile: {
    assignedExpert: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    medicalHistory: String,
    emergencyContact: String,
    status: {
        type: String,
        enum: ['active', 'inactive', 'monitoring'],
        default: 'active'
    },
    lastEvaluation: Date,
    lastRiskAssessment: {
        riskLevel: String,
        riskScore: Number,
        assessedAt: Date,
        chatId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Chat'
        },
        keywordsDetected: Number
    },
    riskLevel: {
        type: String,
        enum: ['minimo', 'bajo', 'medio', 'alto', 'critico'],
        default: 'minimo'
    }
},
    // Para expertos - información profesional
    expertProfile: {
        specialization: String,
        licenseNumber: String,
        yearsOfExperience: Number,
        bio: String,
        assignedPrograms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Program' }],
        assignedFaculties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' }],
        assignedCareers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Career' }],
        maxPatients: {
            type: Number,
            default: 50
        },
        currentPatients: {
            type: Number,
            default: 0
        }
    },
    // Información de contacto general
    contactInfo: {
        phone: String,
        address: String,
        emergencyPhone: String
    },
    // Preferencias y configuración
    preferences: {
        notifications: {
            email: { type: Boolean, default: true },
            highRiskAlerts: { type: Boolean, default: true },
            weeklyReports: { type: Boolean, default: false }
        },
        language: {
            type: String,
            default: 'es'
        },
        timezone: {
            type: String,
            default: 'America/Mexico_City'
        }
    },
    // Metadata del sistema
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    loginCount: {
        type: Number,
        default: 0
    },
    // Para auditoría y seguimiento
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true, // Esto agrega automáticamente createdAt y updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual para el nombre completo (si necesitas más campos)
userSchema.virtual('fullName').get(function() {
    return this.name;
});

// Virtual para obtener estadísticas de pacientes (solo para expertos)
userSchema.virtual('expertStats', {
    ref: 'User',
    localField: '_id',
    foreignField: 'patientProfile.assignedExpert',
    count: true
});

// Middleware para actualizar updatedAt antes de guardar
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Encriptar contraseña antes de guardar
userSchema.pre('save', async function(next) {
    // Solo encriptar si la contraseña fue modificada
    if (!this.isModified('password')) return next();
    
    try {
        this.password = await bcrypt.hash(this.password, 12);
        next();
    } catch (error) {
        next(error);
    }
});

// Encriptar contraseña antes de actualizar si se modifica
userSchema.pre('findOneAndUpdate', async function(next) {
    const update = this.getUpdate();
    if (update.password) {
        try {
            update.password = await bcrypt.hash(update.password, 12);
            this.setUpdate(update);
        } catch (error) {
            return next(error);
        }
    }
    next();
});

// Comparar contraseña
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

// Métodos de verificación de roles
userSchema.methods.isSuperAdmin = function() {
    return this.role === 'superadmin';
};

userSchema.methods.isInstitutionalAdmin = function() {
    return this.role === 'institutional_admin';
};

userSchema.methods.isExpert = function() {
    return this.role === 'expert';
};

userSchema.methods.isRegularUser = function() {
    return this.role === 'user';
};

// ✅ CORREGIDO: Método para verificar si puede crear más pacientes (solo para expertos)
userSchema.methods.canAcceptMorePatients = function() {
    if (!this.isExpert()) return false;
    
    // Asegurarse de que expertProfile existe
    if (!this.expertProfile) {
        this.expertProfile = {
            maxPatients: 50,
            currentPatients: 0
        };
    }
    
    const maxPatients = this.expertProfile.maxPatients || 50;
    const currentPatients = this.expertProfile.currentPatients || 0;
    
    console.log(`📊 Verificando límite de pacientes: ${currentPatients}/${maxPatients}`);
    return currentPatients < maxPatients;
};

// ✅ CORREGIDO: Método para incrementar contador de pacientes
userSchema.methods.incrementPatientCount = async function() {
    if (this.isExpert()) {
        // Asegurarse de que expertProfile existe
        if (!this.expertProfile) {
            this.expertProfile = {
                currentPatients: 0
            };
        }
        
        this.expertProfile.currentPatients = (this.expertProfile.currentPatients || 0) + 1;
        console.log(`➕ Incrementando contador de pacientes: ${this.expertProfile.currentPatients}`);
        await this.save();
    }
};

// ✅ CORREGIDO: Método para decrementar contador de pacientes
userSchema.methods.decrementPatientCount = async function() {
    if (this.isExpert()) {
        if (!this.expertProfile) {
            this.expertProfile = {
                currentPatients: 0
            };
        }
        
        this.expertProfile.currentPatients = Math.max(0, (this.expertProfile.currentPatients || 0) - 1);
        console.log(`➖ Decrementando contador de pacientes: ${this.expertProfile.currentPatients}`);
        await this.save();
    }
};

// ✅ CORREGIDO: Método para actualizar último login
userSchema.methods.updateLastLogin = async function() {
    this.lastLogin = new Date();
    this.loginCount = (this.loginCount || 0) + 1;
    console.log(`🔐 Actualizando último login: ${this.lastLogin}, Total: ${this.loginCount}`);
    await this.save();
};

// ✅ CORREGIDO: Método para obtener información básica del usuario (sin datos sensibles)
userSchema.methods.getPublicProfile = function() {
    const userObject = this.toObject ? this.toObject() : { ...this };
    
    // Remover datos sensibles
    delete userObject.password;
    delete userObject.__v;
    
    // Mantener solo información relevante
    return {
        _id: userObject._id,
        name: userObject.name,
        email: userObject.email,
        age: userObject.age,
        role: userObject.role,
        institution: userObject.institution,
        institutionalPath: userObject.institutionalPath,
        patientProfile: userObject.patientProfile,
        expertProfile: userObject.expertProfile,
        contactInfo: userObject.contactInfo,
        preferences: userObject.preferences,
        createdAt: userObject.createdAt,
        updatedAt: userObject.updatedAt,
        lastLogin: userObject.lastLogin
    };
};

// ✅ NUEVO: Método para inicializar expertProfile si no existe
userSchema.methods.initializeExpertProfile = function() {
    if (this.isExpert() && !this.expertProfile) {
        this.expertProfile = {
            maxPatients: 50,
            currentPatients: 0,
            assignedPrograms: [],
            assignedFaculties: [],
            assignedCareers: []
        };
        console.log('🔄 Perfil de experto inicializado');
    }
};

// ✅ NUEVO: Método para verificar si el usuario puede acceder a un paciente
userSchema.methods.canAccessPatient = function(patientId) {
    if (this.isSuperAdmin()) return true;
    
    if (this.isExpert()) {
        // Un experto solo puede acceder a pacientes que le están asignados
        return this._id.equals(patientId) || 
               (this.patientProfile && this.patientProfile.assignedExpert && 
                this.patientProfile.assignedExpert.equals(this._id));
    }
    
    if (this.isInstitutionalAdmin()) {
        // Un admin institucional puede acceder a pacientes de su institución
        return this.institution && patientId.institution && 
               this.institution.equals(patientId.institution);
    }
    
    return false;
};

// ✅ NUEVO: Método para obtener estadísticas rápidas del experto
userSchema.methods.getExpertStats = async function() {
    if (!this.isExpert()) return null;
    
    try {
        const User = mongoose.model('User');
        const patientCount = await User.countDocuments({
            'patientProfile.assignedExpert': this._id,
            isActive: true
        });
        
        return {
            totalPatients: patientCount,
            maxPatients: this.expertProfile?.maxPatients || 50,
            availableSlots: (this.expertProfile?.maxPatients || 50) - patientCount
        };
    } catch (error) {
        console.error('Error obteniendo estadísticas del experto:', error);
        return null;
    }
};

// Método estático para buscar por email
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

// Método estático para buscar usuarios activos por rol
userSchema.statics.findActiveByRole = function(role) {
    return this.find({ role, isActive: true });
};

// ✅ NUEVO: Método estático para buscar pacientes de un experto
userSchema.statics.findPatientsByExpert = function(expertId, options = {}) {
    const query = {
        'patientProfile.assignedExpert': expertId,
        isActive: true,
        role: 'user'
    };
    
    // Aplicar filtros adicionales
    if (options.riskLevel) {
        query['patientProfile.riskLevel'] = options.riskLevel;
    }
    
    if (options.search) {
        query.$or = [
            { name: { $regex: options.search, $options: 'i' } },
            { email: { $regex: options.search, $options: 'i' } }
        ];
    }
    
    return this.find(query)
        .populate('institutionalPath.program', 'name')
        .populate('institutionalPath.faculty', 'name')
        .populate('institutionalPath.career', 'name')
        .populate('institution', 'name type')
        .select('-password')
        .sort(options.sort || { createdAt: -1 });
};

// ✅ NUEVO: Método estático para contar pacientes por experto
userSchema.statics.countPatientsByExpert = function(expertId) {
    return this.countDocuments({
        'patientProfile.assignedExpert': expertId,
        isActive: true,
        role: 'user'
    });
};

// ✅ NUEVO: Middleware para inicializar perfiles específicos al guardar
userSchema.pre('save', function(next) {
    // Inicializar expertProfile si el usuario es experto
    if (this.isExpert() && (!this.expertProfile || Object.keys(this.expertProfile).length === 0)) {
        this.expertProfile = {
            maxPatients: 50,
            currentPatients: 0,
            assignedPrograms: [],
            assignedFaculties: [],
            assignedCareers: []
        };
        console.log('🔄 Perfil de experto inicializado automáticamente');
    }
    
    // Inicializar patientProfile si el usuario es paciente
    if (this.isRegularUser() && (!this.patientProfile || Object.keys(this.patientProfile).length === 0)) {
        this.patientProfile = {
            status: 'active',
            riskLevel: 'low'
        };
    }
    
    next();
});

// Índices para mejor performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ institution: 1 });
userSchema.index({ 'patientProfile.assignedExpert': 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'institutionalPath.program': 1 });
userSchema.index({ 'institutionalPath.faculty': 1 });
userSchema.index({ 'institutionalPath.career': 1 });
userSchema.index({ 'expertProfile.currentPatients': 1 });
userSchema.index({ 'patientProfile.riskLevel': 1 });
userSchema.index({ 'patientProfile.status': 1 });

module.exports = mongoose.model('User', userSchema);