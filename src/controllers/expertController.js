const mongoose = require('mongoose');
const User = require('../models/User');
const Institution = require('../models/Institution');
const Chat = require('../models/Chat');
const Recommendation = require('../models/Recommendation');
const Program = require('../models/Program');
const Faculty = require('../models/Faculty');
const Career = require('../models/Career');
const Keyword = require('../models/Keyword');
const CrisisDocument = require('../models/CrisisDocument');
const RiskAnalysisService = require('../services/riskAnalysisService');

const expertController = {
    // ✅ CORREGIDO: Crear paciente - Versión completamente corregida
createPatient: async (req, res) => {
    try {
        console.log('📝 Iniciando creación de paciente...');
        console.log('👤 Usuario autenticado:', {
            id: req.user._id,
            email: req.user.email,
            role: req.user.role,
            institution: req.user.institution
        });
        
        const {
            name,
            email,
            password,
            age,
            programId,
            facultyId,
            careerId,
            semester,
            course,
            department,
            medicalHistory,
            emergencyContact,
            grade,
            section,
            schedule,
            position
        } = req.body;

        console.log('📦 Datos recibidos:', {
            name, email, age, programId, facultyId, department, grade, section
        });

        // ✅ CORREGIDO: Verificar permisos de forma más robusta
        if (!req.user || req.user.role !== 'expert') {
            console.log('❌ Permisos insuficientes:', req.user?.role);
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para crear pacientes'
            });
        }

        // ✅ CORREGIDO: Verificar que el experto tiene institución asignada
        if (!req.user.institution) {
            console.log('❌ Experto sin institución asignada');
            return res.status(400).json({
                success: false,
                message: 'No tienes una institución asignada'
            });
        }

        // Verificar si el email ya existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log('❌ Email ya existe:', email);
            return res.status(400).json({
                success: false,
                message: 'El email ya está registrado'
            });
        }

        // ✅ CORREGIDO: Crear datos básicos del paciente con validación mejorada
        const patientData = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: password || 'defaultPassword123',
            role: 'user',
            institution: req.user.institution,
            createdBy: req.user._id,
            lastUpdatedBy: req.user._id,
            isActive: true
        };

        // ✅ CORREGIDO: Agregar edad solo si se proporciona
        if (age && !isNaN(age)) {
            patientData.age = parseInt(age);
        }

        // ✅ CORREGIDO: Inicializar institutionalPath como objeto vacío
        patientData.institutionalPath = {};

        // Obtener institución para determinar el tipo
        const institution = await Institution.findById(req.user.institution);
        console.log('🏢 Institución encontrada:', institution?.name, 'Tipo:', institution?.type);
        
        if (institution) {
            switch (institution.type) {
                case 'university':
                    console.log('🎓 Configurando datos para universidad');
                    if (programId) {
                        if (mongoose.Types.ObjectId.isValid(programId)) {
                            patientData.institutionalPath.program = programId;
                        } else {
                            patientData.institutionalPath.programName = programId;
                        }
                    }
                    
                    if (facultyId) {
                        if (mongoose.Types.ObjectId.isValid(facultyId)) {
                            patientData.institutionalPath.faculty = facultyId;
                        } else {
                            patientData.institutionalPath.facultyName = facultyId;
                        }
                    }
                    
                    if (semester) patientData.institutionalPath.semester = semester;
                    if (course) patientData.institutionalPath.course = course;
                    break;
                    
                case 'school':
                    console.log('🏫 Configurando datos para colegio');
                    if (grade) patientData.institutionalPath.grade = grade;
                    if (section) patientData.institutionalPath.section = section;
                    if (schedule) patientData.institutionalPath.schedule = schedule;
                    if (semester) patientData.institutionalPath.semester = semester;
                    break;
                    
                case 'company':
                    console.log('🏢 Configurando datos para empresa');
                    if (department) patientData.institutionalPath.department = department;
                    if (position) patientData.institutionalPath.position = position;
                    break;
                    
                case 'health_center':
                    console.log('🏥 Configurando datos para centro de salud');
                    if (department) patientData.institutionalPath.department = department;
                    if (course) patientData.institutionalPath.specialty = course;
                    break;
                    
                default:
                    console.log('🏛️ Configurando datos para institución genérica');
                    if (department) patientData.institutionalPath.department = department;
                    if (course) patientData.institutionalPath.course = course;
            }
        } else {
            console.log('⚠️ Institución no encontrada, usando valores por defecto');
            // Valores por defecto si no se encuentra la institución
            if (department) patientData.institutionalPath.department = department;
            if (course) patientData.institutionalPath.course = course;
        }

        // ✅ CORREGIDO: Agregar perfil de paciente con estructura válida
        patientData.patientProfile = {
            assignedExpert: req.user._id,
            status: 'active',
            riskLevel: 'minimo'
        };

        if (medicalHistory) {
            patientData.patientProfile.medicalHistory = medicalHistory;
        }
        if (emergencyContact) {
            patientData.patientProfile.emergencyContact = emergencyContact;
        }

        console.log('💾 Datos finales del paciente:', {
            name: patientData.name,
            email: patientData.email,
            institution: patientData.institution,
            institutionalPath: patientData.institutionalPath,
            patientProfile: patientData.patientProfile
        });

        // ✅ CORREGIDO: Crear el paciente con manejo de errores específico
        let patient;
        try {
            patient = await User.create(patientData);
            console.log('✅ Paciente creado exitosamente:', patient._id);
        } catch (createError) {
            console.error('❌ Error específico al crear paciente:', createError);
            
            // Manejar errores de validación de Mongoose
            if (createError.name === 'ValidationError') {
                const errors = Object.values(createError.errors).map(err => err.message);
                return res.status(400).json({
                    success: false,
                    message: 'Error de validación',
                    errors: errors
                });
            }
            
            // Manejar errores de duplicación
            if (createError.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: 'El email ya está registrado'
                });
            }
            
            throw createError; // Re-lanzar otros errores
        }

        // ✅ CORREGIDO: Intentar incrementar contador de pacientes del experto con mejor manejo de errores
        try {
            await User.findByIdAndUpdate(req.user._id, {
                $inc: { 'expertProfile.currentPatients': 1 }
            });
            console.log('✅ Contador de pacientes incrementado');
        } catch (updateError) {
            console.log('⚠️ No se pudo actualizar el contador de pacientes del experto:', updateError.message);
            // No fallar la operación principal por este error
        }

        res.status(201).json({
            success: true,
            message: 'Paciente creado exitosamente',
            data: { 
                patient: {
                    _id: patient._id,
                    name: patient.name,
                    email: patient.email,
                    age: patient.age,
                    institutionalPath: patient.institutionalPath
                }
            }
        });

    } catch (error) {
        console.error('❌ Error general creando paciente:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al crear paciente',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
        });
    }
},

    // Obtener pacientes del experto
    getMyPatients: async (req, res) => {
        try {
            const expert = req.user;
            const { page = 1, limit = 50, riskLevel, search } = req.query;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver pacientes'
                });
            }

            // Construir filtro
            const filter = {
                'patientProfile.assignedExpert': expert._id,
                isActive: true,
                role: 'user'
            };

            // Filtrar por nivel de riesgo
            if (riskLevel && riskLevel !== 'all') {
                filter['patientProfile.riskLevel'] = riskLevel;
            }

            // Búsqueda por nombre o email
            if (search) {
                filter.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ];
            }

            const patients = await User.find(filter)
                .populate('institutionalPath.program', 'name')
                .populate('institutionalPath.faculty', 'name')
                .populate('institutionalPath.career', 'name')
                .populate('institution', 'name type')
                .select('-password')
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ createdAt: -1 });

            // Obtener estadísticas de chats para cada paciente
            const patientsWithStats = await Promise.all(
                patients.map(async (patient) => {
                    const stats = await Chat.aggregate([
                        { $match: { user: patient._id } },
                        {
                            $group: {
                                _id: null,
                                totalChats: { $sum: 1 },
                                highRiskChats: {
                                    $sum: {
                                        $cond: [{ $eq: ['$riskLevel', 'high'] }, 1, 0]
                                    }
                                },
                                lastActivity: { $max: '$createdAt' }
                            }
                        }
                    ]);

                    const patientObj = patient.toObject();
                    patientObj.stats = stats[0] || {
                        totalChats: 0,
                        highRiskChats: 0,
                        lastActivity: null
                    };

                    return patientObj;
                })
            );

            const total = await User.countDocuments(filter);

            res.json({
                success: true,
                data: {
                    patients: patientsWithStats,
                    pagination: {
                        current: page,
                        pages: Math.ceil(total / limit),
                        total
                    }
                }
            });

        } catch (error) {
            console.error('Error obteniendo pacientes:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener estructura institucional para formularios
    getInstitutionStructure: async (req, res) => {
        try {
            const expert = req.user;
            const { institutionId } = req.params;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para acceder a esta información'
                });
            }

            // Verificar que la institución pertenece al experto
            if (expert.institution.toString() !== institutionId) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes acceso a esta institución'
                });
            }

            const institution = await Institution.findById(institutionId);
            const programs = await Program.find({ institution: institutionId });
            const faculties = await Faculty.find({ institution: institutionId });
            const careers = await Career.find({ institution: institutionId });

            res.json({
                success: true,
                data: {
                    institution,
                    programs,
                    faculties,
                    careers
                }
            });

        } catch (error) {
            console.error('Error obteniendo estructura institucional:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener análisis de un paciente
    getPatientAnalysis: async (req, res) => {
        try {
            const expert = req.user;
            const { patientId } = req.params;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver análisis'
                });
            }

            // Verificar que el paciente pertenece al experto
            const patient = await User.findOne({
                _id: patientId,
                'patientProfile.assignedExpert': expert._id
            });

            if (!patient) {
                return res.status(404).json({
                    success: false,
                    message: 'Paciente no encontrado o no tienes acceso'
                });
            }

            // Obtener todos los chats del paciente con análisis
            const chats = await Chat.find({ user: patientId })
                .select('messages riskLevel riskScore analysis createdAt')
                .sort({ createdAt: -1 });

            // Calcular estadísticas generales
            const stats = await Chat.aggregate([
                { $match: { user: patientId } },
                {
                    $group: {
                        _id: null,
                        totalChats: { $sum: 1 },
                        highRiskChats: {
                            $sum: { $cond: [{ $eq: ['$riskLevel', 'high'] }, 1, 0] }
                        },
                        mediumRiskChats: {
                            $sum: { $cond: [{ $eq: ['$riskLevel', 'medium'] }, 1, 0] }
                        },
                        avgRiskScore: { $avg: '$riskScore' },
                        maxRiskScore: { $max: '$riskScore' },
                        lastActivity: { $max: '$createdAt' }
                    }
                }
            ]);

            // Palabras clave más frecuentes en chats de alto riesgo
            const keywordStats = await Chat.aggregate([
                { $match: { user: patientId, riskLevel: 'high' } },
                { $unwind: '$analysis.keywords' },
                {
                    $group: {
                        _id: '$analysis.keywords',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);

            // Obtener recomendaciones del paciente
            const recommendations = await Recommendation.find({
                userId: patientId,
                expertId: expert._id,
                isActive: true
            }).sort({ createdAt: -1 });

            const analysis = {
                patient: patient.getPublicProfile(),
                generalStats: stats[0] || {
                    totalChats: 0,
                    highRiskChats: 0,
                    mediumRiskChats: 0,
                    avgRiskScore: 0,
                    maxRiskScore: 0,
                    lastActivity: null
                },
                recentChats: chats.slice(0, 10),
                frequentKeywords: keywordStats,
                riskTrend: await expertController.calculateRiskTrend(patientId),
                recommendations: recommendations
            };

            res.json({
                success: true,
                data: { analysis }
            });

        } catch (error) {
            console.error('Error obteniendo análisis:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Calcular tendencia de riesgo
    calculateRiskTrend: async (patientId) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const trend = await Chat.aggregate([
            {
                $match: {
                    user: patientId,
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$createdAt"
                        }
                    },
                    avgRiskScore: { $avg: "$riskScore" },
                    maxRiskScore: { $max: "$riskScore" },
                    chatCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        return trend;
    },

    // Crear recomendación para paciente
    createRecommendation: async (req, res) => {
        try {
            const expert = req.user;
            const {
                userId,
                recommendation,
                priority = 'medium',
                followUpDate,
                category = 'psychological',
                actions = []
            } = req.body;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para crear recomendaciones'
                });
            }

            // Verificar que el paciente pertenece al experto
            const patient = await User.findOne({
                _id: userId,
                'patientProfile.assignedExpert': expert._id
            });

            if (!patient) {
                return res.status(404).json({
                    success: false,
                    message: 'Paciente no encontrado o no tienes acceso'
                });
            }

            const recommendationData = {
                userId,
                expertId: expert._id,
                institution: expert.institution,
                recommendation,
                priority,
                category,
                followUpDate: followUpDate || undefined,
                actions: actions.map(action => ({
                    description: action.description,
                    dueDate: action.dueDate || undefined
                }))
            };

            const newRecommendation = await Recommendation.create(recommendationData);

            // Actualizar última evaluación del paciente
            await User.findByIdAndUpdate(userId, {
                'patientProfile.lastEvaluation': new Date()
            });

            res.status(201).json({
                success: true,
                message: 'Recomendación creada exitosamente',
                data: { recommendation: newRecommendation }
            });

        } catch (error) {
            console.error('Error creando recomendación:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener recomendaciones del experto
    getMyRecommendations: async (req, res) => {
        try {
            const expert = req.user;
            const { status, category } = req.query;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver recomendaciones'
                });
            }

            const filter = { expertId: expert._id, isActive: true };
            if (status) filter.status = status;
            if (category) filter.category = category;

            const recommendations = await Recommendation.find(filter)
                .populate('userId', 'name email institutionalPath')
                .sort({ priority: -1, createdAt: -1 });

            res.json({
                success: true,
                data: { recommendations }
            });

        } catch (error) {
            console.error('Error obteniendo recomendaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Actualizar recomendación
    updateRecommendation: async (req, res) => {
        try {
            const expert = req.user;
            const { recommendationId } = req.params;
            const updateData = req.body;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para actualizar recomendaciones'
                });
            }

            // Verificar que la recomendación pertenece al experto
            const recommendation = await Recommendation.findOne({
                _id: recommendationId,
                expertId: expert._id
            });

            if (!recommendation) {
                return res.status(404).json({
                    success: false,
                    message: 'Recomendación no encontrada'
                });
            }

            // Actualizar la recomendación
            const updatedRecommendation = await Recommendation.findByIdAndUpdate(
                recommendationId,
                { ...updateData, updatedAt: new Date() },
                { new: true, runValidators: true }
            ).populate('userId', 'name email');

            res.json({
                success: true,
                message: 'Recomendación actualizada exitosamente',
                data: { recommendation: updatedRecommendation }
            });

        } catch (error) {
            console.error('Error actualizando recomendación:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener estadísticas del dashboard
    getDashboardStats: async (req, res) => {
    try {
        const expert = req.user;
        const { days = 30 } = req.query;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver estadísticas'
            });
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // ✅ CORREGIDO: Usar la función helper
        const expertPatientIds = await expertController.getExpertPatientIds(expert._id);

        // Estadísticas básicas de pacientes
        const patientStats = await User.aggregate([
            {
                $match: {
                    '_id': { $in: expertPatientIds }, // ✅ CORREGIDO
                    isActive: true,
                    role: 'user'
                }
            },
            {
                $group: {
                    _id: '$patientProfile.riskLevel',
                    count: { $sum: 1 }
                }
            }
        ]);

        // El resto del código permanece igual...
        // ... [código existente]
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

    // Obtener reportes semanales de pacientes
    getWeeklyPatientReports: async (req, res) => {
        try {
            const expert = req.user;
            const { patientId, weeks = 4 } = req.query;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver reportes'
                });
            }

            // Si se especifica un paciente, verificar que pertenece al experto
            let patientFilter = { 'patientProfile.assignedExpert': expert._id };
            if (patientId) {
                patientFilter._id = patientId;
                
                // Verificar que el paciente pertenece al experto
                const patient = await User.findOne(patientFilter);
                if (!patient) {
                    return res.status(404).json({
                        success: false,
                        message: 'Paciente no encontrado o no tienes acceso'
                    });
                }
            }

            // Calcular fecha de inicio (hace X semanas)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - (weeks * 7));

            // Obtener pacientes del experto
            const patients = await User.find(patientFilter)
                .select('name email institutionalPath patientProfile')
                .populate('institutionalPath.program', 'name')
                .populate('institutionalPath.faculty', 'name')
                .populate('institutionalPath.career', 'name');

            // Obtener estadísticas de chats por semana
            const weeklyReports = await Chat.aggregate([
                {
                    $match: {
                        user: { $in: patients.map(p => p._id) },
                        createdAt: { $gte: startDate, $lte: endDate },
                        riskScore: { $ne: null }
                    }
                },
                {
                    $group: {
                        _id: {
                            week: { $week: '$createdAt' },
                            year: { $year: '$createdAt' },
                            patientId: '$user'
                        },
                        patientId: { $first: '$user' },
                        weekStart: { $min: '$createdAt' },
                        totalChats: { $sum: 1 },
                        avgRiskScore: { $avg: '$riskScore' },
                        maxRiskScore: { $max: '$riskScore' },
                        highRiskChats: {
                            $sum: { $cond: [{ $eq: ['$riskLevel', 'high'] }, 1, 0] }
                        },
                        mediumRiskChats: {
                            $sum: { $cond: [{ $eq: ['$riskLevel', 'medium'] }, 1, 0] }
                        }
                    }
                },
                {
                    $sort: { weekStart: 1 }
                },
                {
                    $group: {
                        _id: '$patientId',
                        weeklyData: {
                            $push: {
                                week: '$_id.week',
                                year: '$_id.year',
                                weekStart: '$weekStart',
                                totalChats: '$totalChats',
                                avgRiskScore: '$avgRiskScore',
                                maxRiskScore: '$maxRiskScore',
                                highRiskChats: '$highRiskChats',
                                mediumRiskChats: '$mediumRiskChats'
                            }
                        }
                    }
                }
            ]);

            // Combinar datos de pacientes con sus reportes semanales
            const reports = patients.map(patient => {
                const patientReport = weeklyReports.find(report => 
                    report._id.toString() === patient._id.toString()
                );
                
                return {
                    patient: {
                        _id: patient._id,
                        name: patient.name,
                        email: patient.email,
                        program: patient.institutionalPath?.program?.name,
                        faculty: patient.institutionalPath?.faculty?.name,
                        career: patient.institutionalPath?.career?.name,
                        riskLevel: patient.patientProfile?.riskLevel
                    },
                    weeklyData: patientReport?.weeklyData || [],
                    summary: {
                        totalWeeks: patientReport?.weeklyData.length || 0,
                        overallAvgRisk: patientReport ? 
                            patientReport.weeklyData.reduce((sum, week) => sum + week.avgRiskScore, 0) / patientReport.weeklyData.length : 0,
                        totalHighRiskChats: patientReport ?
                            patientReport.weeklyData.reduce((sum, week) => sum + week.highRiskChats, 0) : 0,
                        trend: patientReport ? expertController.calculateTrend(patientReport.weeklyData) : 'stable'
                    }
                };
            });

            res.json({
                success: true,
                data: {
                    reports,
                    period: {
                        startDate,
                        endDate,
                        weeks: parseInt(weeks)
                    }
                }
            });

        } catch (error) {
            console.error('Error obteniendo reportes semanales:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Calcular tendencia
    calculateTrend: (weeklyData) => {
        if (weeklyData.length < 2) return 'stable';
        
        const firstWeek = weeklyData[0].avgRiskScore;
        const lastWeek = weeklyData[weeklyData.length - 1].avgRiskScore;
        
        if (lastWeek > firstWeek + 5) return 'increasing';
        if (lastWeek < firstWeek - 5) return 'decreasing';
        return 'stable';
    },

    // ✅ CORREGIDO: Crear programa (solo para universidades)
    createProgram: async (req, res) => {
    try {
        const expert = req.user;
        const { name, description } = req.body;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para crear programas'
            });
        }

        // Verificar que la institución es una universidad
        const institution = await Institution.findById(expert.institution);
        if (!institution || institution.type !== 'university') {
            return res.status(403).json({
                success: false,
                message: 'Solo las universidades pueden crear programas'
            });
        }

        // Verificar si ya existe un programa con el mismo nombre en la misma institución
        const existingProgram = await Program.findOne({ 
            name: name,
            institution: expert.institution 
        });

        if (existingProgram) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe un programa con este nombre en tu institución'
            });
        }

        // ✅ CORREGIDO: Crear programa con type válido
        const programData = {
            name,
            description: description || '',
            institution: expert.institution,
            createdBy: expert._id,
            type: 'undergraduate' // ✅ Valor por defecto válido
        };

        console.log('🎯 Creando programa con datos:', programData);

        const program = await Program.create(programData);
        
        res.status(201).json({
            success: true,
            message: 'Programa creado exitosamente',
            data: { program }
        });

    } catch (error) {
        console.error('Error creando programa:', error);
        
        // ✅ CORREGIDO: Manejar error de validación específico
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Error de validación: ' + error.message,
                error: error.errors
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

    // ✅ CORREGIDO: Crear facultad (solo para universidades)
    createFaculty: async (req, res) => {
        try {
            const expert = req.user;
            const { name, description } = req.body;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para crear facultades'
                });
            }

            // Verificar que la institución es una universidad
            const institution = await Institution.findById(expert.institution);
            if (!institution || institution.type !== 'university') {
                return res.status(403).json({
                    success: false,
                    message: 'Solo las universidades pueden crear facultades'
                });
            }

            // Verificar si ya existe una facultad con el mismo nombre en la misma institución
            const existingFaculty = await Faculty.findOne({ 
                name: name,
                institution: expert.institution 
            });

            if (existingFaculty) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe una facultad con este nombre en tu institución'
                });
            }

            // ✅ CORREGIDO: Crear facultad con datos completos
            const facultyData = {
                name,
                description: description || '',
                institution: expert.institution,
                createdBy: expert._id
            };

            // ✅ CORREGIDO: Si el modelo Faculty requiere campos adicionales, manejarlos
            try {
                const faculty = await Faculty.create(facultyData);

                res.status(201).json({
                    success: true,
                    message: 'Facultad creada exitosamente',
                    data: { faculty }
                });
            } catch (validationError) {
                console.error('Error de validación creando facultad:', validationError);
                throw validationError;
            }

        } catch (error) {
            console.error('Error creando facultad:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener programas del experto (solo para universidades)
    getMyPrograms: async (req, res) => {
        try {
            const expert = req.user;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver programas'
                });
            }

            // Verificar que la institución es una universidad
            const institution = await Institution.findById(expert.institution);
            if (!institution || institution.type !== 'university') {
                return res.status(403).json({
                    success: false,
                    message: 'Solo las universidades pueden ver programas'
                });
            }

            const programs = await Program.find({ institution: expert.institution })
                .sort({ name: 1 });

            res.json({
                success: true,
                data: { programs }
            });

        } catch (error) {
            console.error('Error obteniendo programas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener facultades del experto (solo para universidades)
    getMyFaculties: async (req, res) => {
        try {
            const expert = req.user;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver facultades'
                });
            }

            // Verificar que la institución es una universidad
            const institution = await Institution.findById(expert.institution);
            if (!institution || institution.type !== 'university') {
                return res.status(403).json({
                    success: false,
                    message: 'Solo las universidades pueden ver facultades'
                });
            }

            const faculties = await Faculty.find({ institution: expert.institution })
                .sort({ name: 1 });

            res.json({
                success: true,
                data: { faculties }
            });

        } catch (error) {
            console.error('Error obteniendo facultades:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Actualizar programa (solo para universidades)
    updateProgram: async (req, res) => {
        try {
            const expert = req.user;
            const { programId } = req.params;
            const { name, description } = req.body;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para actualizar programas'
                });
            }

            // Verificar que el programa existe y pertenece a la institución del experto
            const program = await Program.findOne({
                _id: programId,
                institution: expert.institution
            });

            if (!program) {
                return res.status(404).json({
                    success: false,
                    message: 'Programa no encontrado'
                });
            }

            // Verificar si ya existe otro programa con el mismo nombre
            if (name && name !== program.name) {
                const existingProgram = await Program.findOne({
                    name: name,
                    institution: expert.institution,
                    _id: { $ne: programId }
                });

                if (existingProgram) {
                    return res.status(400).json({
                        success: false,
                        message: 'Ya existe un programa con este nombre en tu institución'
                    });
                }
            }

            const updatedProgram = await Program.findByIdAndUpdate(
                programId,
                { 
                    name: name || program.name,
                    description: description !== undefined ? description : program.description,
                    updatedAt: new Date()
                },
                { new: true, runValidators: true }
            );

            res.json({
                success: true,
                message: 'Programa actualizado exitosamente',
                data: { program: updatedProgram }
            });

        } catch (error) {
            console.error('Error actualizando programa:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Actualizar facultad (solo para universidades)
    updateFaculty: async (req, res) => {
        try {
            const expert = req.user;
            const { facultyId } = req.params;
            const { name, description } = req.body;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para actualizar facultades'
                });
            }

            // Verificar que la facultad existe y pertenece a la institución del experto
            const faculty = await Faculty.findOne({
                _id: facultyId,
                institution: expert.institution
            });

            if (!faculty) {
                return res.status(404).json({
                    success: false,
                    message: 'Facultad no encontrada'
                });
            }

            // Verificar si ya existe otra facultad con el mismo nombre
            if (name && name !== faculty.name) {
                const existingFaculty = await Faculty.findOne({
                    name: name,
                    institution: expert.institution,
                    _id: { $ne: facultyId }
                });

                if (existingFaculty) {
                    return res.status(400).json({
                        success: false,
                        message: 'Ya existe una facultad con este nombre en tu institución'
                    });
                }
            }

            const updatedFaculty = await Faculty.findByIdAndUpdate(
                facultyId,
                { 
                    name: name || faculty.name,
                    description: description !== undefined ? description : faculty.description,
                    updatedAt: new Date()
                },
                { new: true, runValidators: true }
            );

            res.json({
                success: true,
                message: 'Facultad actualizada exitosamente',
                data: { faculty: updatedFaculty }
            });

        } catch (error) {
            console.error('Error actualizando facultad:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Eliminar programa (solo para universidades)
    deleteProgram: async (req, res) => {
        try {
            const expert = req.user;
            const { programId } = req.params;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para eliminar programas'
                });
            }

            // Verificar que el programa existe y pertenece a la institución del experto
            const program = await Program.findOne({
                _id: programId,
                institution: expert.institution
            });

            if (!program) {
                return res.status(404).json({
                    success: false,
                    message: 'Programa no encontrado'
                });
            }

            // Verificar si hay pacientes asignados a este programa
            const patientsWithProgram = await User.countDocuments({
                'institutionalPath.program': programId,
                isActive: true
            });

            if (patientsWithProgram > 0) {
                return res.status(400).json({
                    success: false,
                    message: `No se puede eliminar el programa porque tiene ${patientsWithProgram} paciente(s) asignado(s)`
                });
            }

            await Program.findByIdAndDelete(programId);

            res.json({
                success: true,
                message: 'Programa eliminado exitosamente'
            });

        } catch (error) {
            console.error('Error eliminando programa:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Eliminar facultad (solo para universidades)
    deleteFaculty: async (req, res) => {
        try {
            const expert = req.user;
            const { facultyId } = req.params;

            if (expert.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para eliminar facultades'
                });
            }

            // Verificar que la facultad existe y pertenece a la institución del experto
            const faculty = await Faculty.findOne({
                _id: facultyId,
                institution: expert.institution
            });

            if (!faculty) {
                return res.status(404).json({
                    success: false,
                    message: 'Facultad no encontrada'
                });
            }

            // Verificar si hay pacientes asignados a esta facultad
            const patientsWithFaculty = await User.countDocuments({
                'institutionalPath.faculty': facultyId,
                isActive: true
            });

            if (patientsWithFaculty > 0) {
                return res.status(400).json({
                    success: false,
                    message: `No se puede eliminar la facultad porque tiene ${patientsWithFaculty} paciente(s) asignado(s)`
                });
            }

            await Faculty.findByIdAndDelete(facultyId);

            res.json({
                success: true,
                message: 'Facultad eliminada exitosamente'
            });

        } catch (error) {
            console.error('Error eliminando facultad:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Agregar nueva palabra clave
addKeyword: async (req, res) => {
    try {
        const expert = req.user;
        const { symptom, keyword, weight } = req.body;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para agregar palabras clave'
            });
        }

        // Verificar si ya existe la misma palabra clave para este síntoma y experto
        const existingKeyword = await Keyword.findOne({
            expertId: expert._id,
            keyword: keyword.toLowerCase().trim(),
            symptom: symptom,
            isActive: true
        });

        if (existingKeyword) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe esta palabra clave para el síntoma seleccionado'
            });
        }

        const keywordData = {
            symptom,
            keyword: keyword.toLowerCase().trim(),
            weight: parseInt(weight),
            expertId: expert._id,
            institution: expert.institution
        };

        const newKeyword = await Keyword.create(keywordData);

        res.status(201).json({
            success: true,
            message: 'Palabra clave agregada exitosamente',
            data: { keyword: newKeyword }
        });

    } catch (error) {
        console.error('Error agregando palabra clave:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// Obtener palabras clave del experto
getMyKeywords: async (req, res) => {
    try {
        const expert = req.user;
        const { symptom } = req.query;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver palabras clave'
            });
        }

        const keywords = await Keyword.findByExpert(expert._id, symptom);

        // Agrupar por síntoma para facilitar el uso en frontend
        const groupedKeywords = keywords.reduce((acc, keyword) => {
            if (!acc[keyword.symptom]) {
                acc[keyword.symptom] = [];
            }
            acc[keyword.symptom].push(keyword);
            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                keywords: groupedKeywords,
                total: keywords.length
            }
        });

    } catch (error) {
        console.error('Error obteniendo palabras clave:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// Obtener palabras clave por síntoma
getKeywordsBySymptom: async (req, res) => {
    try {
        const expert = req.user;
        const { symptom } = req.params;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver palabras clave'
            });
        }

        const keywords = await Keyword.findByExpert(expert._id, symptom);

        res.json({
            success: true,
            data: {
                symptom,
                keywords: keywords,
                count: keywords.length
            }
        });

    } catch (error) {
        console.error('Error obteniendo palabras clave por síntoma:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// Actualizar palabra clave
updateKeyword: async (req, res) => {
    try {
        const expert = req.user;
        const { keywordId } = req.params;
        const { symptom, keyword, weight } = req.body;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para actualizar palabras clave'
            });
        }

        // Verificar que la palabra clave pertenece al experto
        const existingKeyword = await Keyword.findOne({
            _id: keywordId,
            expertId: expert._id
        });

        if (!existingKeyword) {
            return res.status(404).json({
                success: false,
                message: 'Palabra clave no encontrada'
            });
        }

        // Verificar duplicados si se cambia la palabra clave
        if (keyword && keyword !== existingKeyword.keyword) {
            const duplicate = await Keyword.findOne({
                expertId: expert._id,
                keyword: keyword.toLowerCase().trim(),
                symptom: symptom || existingKeyword.symptom,
                isActive: true,
                _id: { $ne: keywordId }
            });

            if (duplicate) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe esta palabra clave para el síntoma seleccionado'
                });
            }
        }

        const updateData = {};
        if (symptom) updateData.symptom = symptom;
        if (keyword) updateData.keyword = keyword.toLowerCase().trim();
        if (weight) updateData.weight = parseInt(weight);

        const updatedKeyword = await Keyword.findByIdAndUpdate(
            keywordId,
            updateData,
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            message: 'Palabra clave actualizada exitosamente',
            data: { keyword: updatedKeyword }
        });

    } catch (error) {
        console.error('Error actualizando palabra clave:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// Eliminar palabra clave (soft delete)
deleteKeyword: async (req, res) => {
    try {
        const expert = req.user;
        const { keywordId } = req.params;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para eliminar palabras clave'
            });
        }

        // Verificar que la palabra clave pertenece al experto
        const keyword = await Keyword.findOne({
            _id: keywordId,
            expertId: expert._id
        });

        if (!keyword) {
            return res.status(404).json({
                success: false,
                message: 'Palabra clave no encontrada'
            });
        }

        // Soft delete
        await Keyword.findByIdAndUpdate(keywordId, { isActive: false });

        res.json({
            success: true,
            message: 'Palabra clave eliminada exitosamente'
        });

    } catch (error) {
        console.error('Error eliminando palabra clave:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// ==================== GESTIÓN DE DOCUMENTOS ====================

// Subir documento de crisis
uploadDocument: async (req, res) => {
    try {
        const expert = req.user;
        const { title, description, category } = req.body;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para subir documentos'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No se ha subido ningún archivo'
            });
        }

        const documentData = {
            title,
            description,
            category: category || 'protocolo',
            fileName: req.file.originalname,
            filePath: req.file.path,
            fileSize: req.file.size,
            fileType: req.file.mimetype,
            expertId: expert._id,
            institution: expert.institution
        };

        const newDocument = await CrisisDocument.create(documentData);

        res.status(201).json({
            success: true,
            message: 'Documento subido exitosamente',
            data: { document: newDocument }
        });

    } catch (error) {
        console.error('Error subiendo documento:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// Obtener documentos del experto
getMyDocuments: async (req, res) => {
    try {
        const expert = req.user;
        const { category } = req.query;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver documentos'
            });
        }

        const documents = await CrisisDocument.findByInstitution(expert.institution, category);

        res.json({
            success: true,
            data: {
                documents: documents,
                total: documents.length
            }
        });

    } catch (error) {
        console.error('Error obteniendo documentos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// Obtener documentos por categoría
getDocumentsByCategory: async (req, res) => {
    try {
        const expert = req.user;
        const { category } = req.params;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver documentos'
            });
        }

        const documents = await CrisisDocument.findByInstitution(expert.institution, category);

        res.json({
            success: true,
            data: {
                category,
                documents: documents,
                count: documents.length
            }
        });

    } catch (error) {
        console.error('Error obteniendo documentos por categoría:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// Eliminar documento
deleteDocument: async (req, res) => {
    try {
        const expert = req.user;
        const { documentId } = req.params;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para eliminar documentos'
            });
        }

        // Verificar que el documento pertenece al experto
        const document = await CrisisDocument.findOne({
            _id: documentId,
            expertId: expert._id
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Documento no encontrado'
            });
        }

        // Soft delete
        await CrisisDocument.findByIdAndUpdate(documentId, { isActive: false });

        // Aquí podrías agregar lógica para eliminar el archivo físico del servidor

        res.json({
            success: true,
            message: 'Documento eliminado exitosamente'
        });

    } catch (error) {
        console.error('Error eliminando documento:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// Incrementar contador de descargas
incrementDownloadCount: async (req, res) => {
    try {
        const expert = req.user;
        const { documentId } = req.params;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para descargar documentos'
            });
        }

        const document = await CrisisDocument.findOne({
            _id: documentId,
            isActive: true
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Documento no encontrado'
            });
        }

        await document.incrementDownloadCount();

        res.json({
            success: true,
            message: 'Contador de descargas actualizado',
            data: { 
                downloadCount: document.downloadCount,
                filePath: document.filePath 
            }
        });

    } catch (error) {
        console.error('Error incrementando contador de descargas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

analyzeConversationWithKeywords: async (req, res) => {
    try {
        const expert = req.user;
        const { conversationText, patientId } = req.body;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para realizar análisis'
            });
        }

        if (!conversationText) {
            return res.status(400).json({
                success: false,
                message: 'El texto de la conversación es requerido'
            });
        }

        // Realizar análisis con palabras clave
        const analysis = await RiskAnalysisService.analyzeConversationWithKeywords(
            conversationText, 
            expert.institution
        );

        // Si se proporcionó patientId, actualizar el perfil del paciente
        if (patientId) {
            await User.findByIdAndUpdate(patientId, {
                'patientProfile.lastRiskAssessment': {
                    riskLevel: analysis.riskLevel,
                    riskScore: analysis.riskScore,
                    assessedAt: new Date(),
                    keywordsDetected: analysis.detectedKeywords.length
                }
            });
        }

        res.json({
            success: true,
            message: 'Análisis completado exitosamente',
            data: { analysis }
        });

    } catch (error) {
        console.error('Error analizando conversación:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

/**
 * Obtener estadísticas de palabras clave
 */
getKeywordStats: async (req, res) => {
    try {
        const expert = req.user;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver estadísticas'
            });
        }

        const stats = await RiskAnalysisService.getKeywordStats(expert.institution);

        res.json({
            success: true,
            data: { stats }
        });

    } catch (error) {
        console.error('Error obteniendo estadísticas de palabras clave:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

/**
 * Probar palabra clave en texto de ejemplo
 */
testKeyword: async (req, res) => {
    try {
        const expert = req.user;
        const { text, keyword } = req.body;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para realizar pruebas'
            });
        }

        if (!text || !keyword) {
            return res.status(400).json({
                success: false,
                message: 'Texto y palabra clave son requeridos'
            });
        }

        // Obtener todas las palabras clave para el análisis
        const keywords = await Keyword.findByInstitution(expert.institution);
        
        // Buscar la palabra clave específica
        const targetKeyword = keywords.find(kw => 
            kw.keyword.toLowerCase() === keyword.toLowerCase()
        );

        if (!targetKeyword) {
            return res.status(404).json({
                success: false,
                message: 'Palabra clave no encontrada en tu institución'
            });
        }

        // Realizar análisis
        const analysis = RiskAnalysisService.localKeywordAnalysis(text, [targetKeyword]);

        res.json({
            success: true,
            data: {
                keyword: targetKeyword,
                detected: analysis.detectedKeywords.length > 0,
                context: analysis.detectedKeywords[0]?.context || '',
                analysis: analysis
            }
        });

    } catch (error) {
        console.error('Error probando palabra clave:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// Agrega este método:
getPatientRiskHistory: async (req, res) => {
    try {
        const expert = req.user;
        const { patientId } = req.params;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver historial'
            });
        }

        // Verificar que el paciente pertenece al experto
        const patient = await User.findOne({
            _id: patientId,
            'patientProfile.assignedExpert': expert._id
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado'
            });
        }

        const history = await RealTimeAnalysisService.getPatientRiskHistory(patientId);

        res.json({
            success: true,
            data: { history }
        });

    } catch (error) {
        console.error('Error obteniendo historial de riesgo:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// ✅ NUEVO MÉTODO: Obtener chats de un paciente
getPatientChats: async (req, res) => {
    try {
        const expert = req.user;
        const { patientId } = req.params;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver conversaciones'
            });
        }

        // Verificar que el paciente pertenece al experto
        const patient = await User.findOne({
            _id: patientId,
            'patientProfile.assignedExpert': expert._id
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado o no tienes acceso'
            });
        }

        // Obtener chats del paciente con análisis
        const chats = await Chat.find({ 
            user: patientId,
            isActive: true 
        })
        .select('title messages riskLevel riskScore analysis createdAt updatedAt')
        .sort({ createdAt: -1 })
        .limit(50);

        res.json({
            success: true,
            data: {
                patient: {
                    _id: patient._id,
                    name: patient.name,
                    email: patient.email
                },
                chats: chats,
                total: chats.length
            }
        });

    } catch (error) {
        console.error('Error obteniendo conversaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// ✅ NUEVO: Toggle estado activo/inactivo del paciente
togglePatientStatus: async (req, res) => {
    try {
        const expert = req.user;
        const { patientId } = req.params;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para modificar pacientes'
            });
        }

        // Verificar que el paciente pertenece al experto
        const patient = await User.findOne({
            _id: patientId,
            'patientProfile.assignedExpert': expert._id
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado o no tienes acceso'
            });
        }

        // Cambiar estado
        const newStatus = patient.isActive ? false : true;
        await User.findByIdAndUpdate(patientId, { 
            isActive: newStatus,
            updatedAt: new Date()
        });

        res.json({
            success: true,
            message: `Paciente ${newStatus ? 'activado' : 'deshabilitado'} exitosamente`,
            data: { 
                isActive: newStatus 
            }
        });

    } catch (error) {
        console.error('Error cambiando estado del paciente:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// ✅ NUEVO: Obtener reporte diario de un paciente por semana
getPatientDailyReport: async (req, res) => {
    try {
        const expert = req.user;
        const { patientId } = req.params;
        const { month, year } = req.query;

        console.log('📊 SOLICITUD DE ANÁLISIS:', { patientId, month, year });

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos'
            });
        }

        // Verificar paciente
        const patient = await User.findById(patientId);
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado'
            });
        }

        // Determinar fechas del mes
        const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const currentYear = year ? parseInt(year) : new Date().getFullYear();
        
        const start = new Date(currentYear, currentMonth - 1, 1);
        const end = new Date(currentYear, currentMonth, 0, 23, 59, 59);

        console.log('📅 PERÍODO:', { start, end, currentMonth, currentYear });

        // Buscar chats de forma más flexible
        const chats = await Chat.find({
            user: patientId,
            createdAt: { $gte: start, $lte: end }
        }).lean(); // Usar lean() para mejor performance

        console.log(`💬 CHATS ENCONTRADOS: ${chats.length}`);

        // Si no hay chats, retornar estructura vacía pero válida
        if (chats.length === 0) {
            console.log('⚠️ No hay chats para el período');
            
            const dailyReports = [];
            const currentDate = new Date(start);
            const lastDay = new Date(end);
            
            while (currentDate <= lastDay) {
                dailyReports.push({
                    date: currentDate.toISOString().split('T')[0],
                    totalChats: 0,
                    highRiskChats: 0,
                    mediumRiskChats: 0,
                    avgRiskScore: 0,
                    maxRiskScore: 0,
                    keywordStats: { total: 0, unique: 0, mostFrequent: [] },
                    moodIndicator: 'neutral',
                    activityLevel: 'none',
                    hasData: false
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }

            return res.json({
                success: true,
                data: {
                    patient: {
                        _id: patient._id,
                        name: patient.name,
                        email: patient.email,
                        riskLevel: patient.patientProfile?.riskLevel || 'minimo'
                    },
                    period: { start, end, month: currentMonth, year: currentYear },
                    dailyReports,
                    summary: {
                        totalChats: 0,
                        highRiskChats: 0,
                        avgRiskScore: 0,
                        riskTrend: 'stable',
                        activityDays: 0,
                        highRiskDays: 0,
                        totalDays: dailyReports.length
                    }
                }
            });
        }

        // ... resto del código de análisis (el mismo que antes)
        // Procesar los chats que sí existen

    } catch (error) {
        console.error('❌ Error en análisis:', error);
        res.status(500).json({
            success: false,
            message: 'Error en análisis: ' + error.message,
            error: error.message
        });
    }
},

diagnosePatientData: async (req, res) => {
    try {
        const expert = req.user;
        const { patientId } = req.params;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos'
            });
        }

        // Verificar que el paciente pertenece al experto
        const patient = await User.findOne({
            _id: patientId,
            'patientProfile.assignedExpert': expert._id
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado'
            });
        }

        console.log('🔍 DIAGNÓSTICO para paciente:', patientId);

        // 1. Verificar datos básicos del paciente
        const patientData = {
            name: patient.name,
            email: patient.email,
            riskLevel: patient.patientProfile?.riskLevel,
            isActive: patient.isActive,
            createdAt: patient.createdAt
        };

        // 2. Verificar todos los chats del paciente
        const allChats = await Chat.find({ user: patientId });
        console.log(`📊 Total de chats encontrados: ${allChats.length}`);

        // 3. Analizar estructura de los chats
        const chatAnalysis = allChats.map(chat => ({
            _id: chat._id,
            createdAt: chat.createdAt,
            riskLevel: chat.riskLevel,
            riskScore: chat.riskScore,
            hasAnalysis: !!chat.analysis,
            analysisKeys: chat.analysis ? Object.keys(chat.analysis) : [],
            messageCount: chat.messages ? chat.messages.length : 0,
            hasKeywords: chat.analysis?.keywords ? chat.analysis.keywords.length > 0 : false
        }));

        // 4. Verificar chats recientes (últimos 30 días)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentChats = await Chat.find({
            user: patientId,
            createdAt: { $gte: thirtyDaysAgo }
        });

        // 5. Verificar estructura de un chat de ejemplo
        let sampleChat = null;
        if (allChats.length > 0) {
            sampleChat = await Chat.findById(allChats[0]._id);
        }

        res.json({
            success: true,
            data: {
                patient: patientData,
                summary: {
                    totalChats: allChats.length,
                    recentChats: recentChats.length,
                    chatsWithRisk: allChats.filter(c => c.riskLevel).length,
                    chatsWithAnalysis: allChats.filter(c => c.analysis).length
                },
                chatAnalysis,
                sampleChat: sampleChat ? {
                    _id: sampleChat._id,
                    riskLevel: sampleChat.riskLevel,
                    riskScore: sampleChat.riskScore,
                    analysis: sampleChat.analysis,
                    messages: sampleChat.messages ? sampleChat.messages.slice(0, 2) : [],
                    createdAt: sampleChat.createdAt
                } : null,
                diagnosis: {
                    hasChats: allChats.length > 0,
                    hasRecentChats: recentChats.length > 0,
                    hasRiskData: allChats.some(c => c.riskLevel),
                    hasAnalysisData: allChats.some(c => c.analysis)
                }
            }
        });

    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
        res.status(500).json({
            success: false,
            message: 'Error en diagnóstico',
            error: error.message
        });
    }
},

getInstitutionConfig: async (req, res) => {
    try {
        const expert = req.user;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos'
            });
        }

        // Obtener información de la institución
        const institution = await Institution.findById(expert.institution);
        const institutionType = institution?.type || 'university';

        // Configuración por tipo de institución
        const institutionConfig = {
            university: {
                name: 'Universidad',
                filters: {
                    program: { label: 'Programa', field: 'program' },
                    faculty: { label: 'Facultad', field: 'faculty' },
                    riskLevel: { label: 'Nivel de Riesgo', field: 'riskLevel' },
                    status: { label: 'Estado', field: 'status' }
                },
                tableColumns: [
                    { key: 'name', label: 'Nombre' },
                    { key: 'email', label: 'Email' },
                    { key: 'program', label: 'Programa' },
                    { key: 'faculty', label: 'Facultad' },
                    { key: 'riskLevel', label: 'Nivel de Riesgo' },
                    { key: 'lastActivity', label: 'Última Actividad' },
                    { key: 'status', label: 'Estado' },
                    { key: 'actions', label: 'Acciones' }
                ],
                formFields: {
                    program: { required: true, label: 'Programa *', type: 'select' },
                    faculty: { required: true, label: 'Facultad *', type: 'select' },
                    semester: { required: true, label: 'Semestre *', type: 'select' },
                    course: { required: false, label: 'Curso/Materia', type: 'text' }
                }
            },
            school: {
                name: 'Colegio',
                filters: {
                    grade: { label: 'Grado', field: 'grade' },
                    section: { label: 'Sección', field: 'section' },
                    riskLevel: { label: 'Nivel de Riesgo', field: 'riskLevel' },
                    status: { label: 'Estado', field: 'status' }
                },
                tableColumns: [
                    { key: 'name', label: 'Nombre' },
                    { key: 'email', label: 'Email' },
                    { key: 'grade', label: 'Grado' },
                    { key: 'section', label: 'Sección' },
                    { key: 'riskLevel', label: 'Nivel de Riesgo' },
                    { key: 'lastActivity', label: 'Última Actividad' },
                    { key: 'status', label: 'Estado' },
                    { key: 'actions', label: 'Acciones' }
                ],
                formFields: {
                    grade: { required: true, label: 'Grado/Curso *', type: 'select' },
                    section: { required: false, label: 'Sección/Grupo', type: 'select' },
                    semester: { required: true, label: 'Periodo Académico *', type: 'text' },
                    schedule: { required: false, label: 'Jornada', type: 'select' }
                }
            },
            company: {
                name: 'Empresa',
                filters: {
                    department: { label: 'Departamento', field: 'department' },
                    position: { label: 'Cargo', field: 'position' },
                    riskLevel: { label: 'Nivel de Riesgo', field: 'riskLevel' },
                    status: { label: 'Estado', field: 'status' }
                },
                tableColumns: [
                    { key: 'name', label: 'Nombre' },
                    { key: 'email', label: 'Email' },
                    { key: 'department', label: 'Departamento' },
                    { key: 'position', label: 'Cargo' },
                    { key: 'riskLevel', label: 'Nivel de Riesgo' },
                    { key: 'lastActivity', label: 'Última Actividad' },
                    { key: 'status', label: 'Estado' },
                    { key: 'actions', label: 'Acciones' }
                ],
                formFields: {
                    department: { required: true, label: 'Departamento *', type: 'text' },
                    position: { required: false, label: 'Puesto/Cargo', type: 'text' }
                }
            },
            health_center: {
                name: 'Centro de Salud',
                filters: {
                    department: { label: 'Departamento', field: 'department' },
                    specialty: { label: 'Especialidad', field: 'specialty' },
                    riskLevel: { label: 'Nivel de Riesgo', field: 'riskLevel' },
                    status: { label: 'Estado', field: 'status' }
                },
                tableColumns: [
                    { key: 'name', label: 'Nombre' },
                    { key: 'email', label: 'Email' },
                    { key: 'department', label: 'Departamento' },
                    { key: 'specialty', label: 'Especialidad' },
                    { key: 'riskLevel', label: 'Nivel de Riesgo' },
                    { key: 'lastActivity', label: 'Última Actividad' },
                    { key: 'status', label: 'Estado' },
                    { key: 'actions', label: 'Acciones' }
                ],
                formFields: {
                    department: { required: false, label: 'Departamento/Área', type: 'text' },
                    specialty: { required: false, label: 'Especialidad', type: 'text' }
                }
            }
        };

        const config = institutionConfig[institutionType] || institutionConfig.university;

        res.json({
            success: true,
            data: {
                institutionType,
                institutionName: institution?.name || 'Institución',
                config
            }
        });

    } catch (error) {
        console.error('Error obteniendo configuración institucional:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

getFilterOptions: async (req, res) => {
    try {
        const expert = req.user;
        
        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos'
            });
        }

        // Obtener información de la institución
        const institution = await Institution.findById(expert.institution);
        const institutionType = institution?.type || 'university';

        // Obtener IDs de pacientes del experto
        const expertPatientIds = await expertController.getExpertPatientIds(expert._id);

        let filterOptions = {
            institutionType: institutionType,
            institutionName: institution?.name || 'Institución'
        };

        // ✅ CORREGIDO: Obtener opciones según el tipo de institución
        switch (institutionType) {
            case 'university':
                // ✅ UNIVERSIDAD: Solo programas (quitamos facultades y semestre)
                filterOptions.programs = await Program.find({ 
                    institution: expert.institution 
                }).select('name _id').sort({ name: 1 });
                break;

            case 'school':
                // ✅ COLEGIO: Solo grados (quitamos sección y jornada)
                const gradeResults = await User.aggregate([
                    {
                        $match: {
                            '_id': { $in: expertPatientIds },
                            'institutionalPath.grade': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: '$institutionalPath.grade'
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);
                
                filterOptions.grades = gradeResults.map(g => g._id).filter(Boolean);
                break;

            case 'company':
                // ✅ EMPRESA: Departamentos únicos
                const deptResults = await User.aggregate([
                    {
                        $match: {
                            '_id': { $in: expertPatientIds },
                            'institutionalPath.department': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: '$institutionalPath.department'
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);

                filterOptions.departments = deptResults.map(d => d._id).filter(Boolean);
                break;

            case 'health_center':
                // ✅ CENTRO DE SALUD: Departamentos únicos
                const healthDeptResults = await User.aggregate([
                    {
                        $match: {
                            '_id': { $in: expertPatientIds },
                            'institutionalPath.department': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: '$institutionalPath.department'
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);

                filterOptions.departments = healthDeptResults.map(d => d._id).filter(Boolean);
                break;

            default:
                // Opciones genéricas
                const genericDeptResults = await User.aggregate([
                    {
                        $match: {
                            '_id': { $in: expertPatientIds },
                            'institutionalPath.department': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: '$institutionalPath.department'
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);

                filterOptions.departments = genericDeptResults.map(d => d._id).filter(Boolean);
        }

        // Opciones comunes para todos
        filterOptions.riskLevels = ['minimo', 'bajo', 'medio', 'alto', 'critico'];
        filterOptions.statusOptions = ['active', 'inactive'];

        res.json({
            success: true,
            data: filterOptions
        });

    } catch (error) {
        console.error('Error obteniendo opciones de filtro:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

generateSampleData: async (req, res) => {
    try {
        const expert = req.user;
        const { patientId } = req.params;

        console.log('🎯 GENERANDO DATOS DE EJEMPLO para paciente:', patientId);

        // Verificar permisos básicos
        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos'
            });
        }

        // Verificar que el paciente existe y pertenece al experto
        const patient = await User.findOne({
            _id: patientId,
            'patientProfile.assignedExpert': expert._id
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado o no tienes acceso'
            });
        }

        console.log('✅ Paciente válido:', patient.name);

        // Crear datos de ejemplo simples
        const sampleChats = [];
        const now = new Date();
        
        // Generar 5-10 chats de ejemplo para los últimos 7 días
        const chatCount = Math.floor(Math.random() * 6) + 5; // 5-10 chats
        
        for (let i = 0; i < chatCount; i++) {
            // Fecha aleatoria en los últimos 7 días
            const daysAgo = Math.floor(Math.random() * 7);
            const chatDate = new Date(now);
            chatDate.setDate(chatDate.getDate() - daysAgo);
            chatDate.setHours(Math.floor(Math.random() * 24));
            chatDate.setMinutes(Math.floor(Math.random() * 60));
            
            // ✅ CORREGIDO: Usar valores válidos del enum
            const riskLevels = ['minimo', 'bajo', 'medio', 'alto', 'critico'];
            const riskLevel = riskLevels[Math.floor(Math.random() * riskLevels.length)];
            const riskScore = riskLevel === 'critico' ? 
                Math.floor(Math.random() * 20) + 80 : 
                riskLevel === 'alto' ? 
                Math.floor(Math.random() * 20) + 60 :
                riskLevel === 'medio' ? 
                Math.floor(Math.random() * 20) + 40 :
                riskLevel === 'bajo' ?
                Math.floor(Math.random() * 20) + 20 :
                Math.floor(Math.random() * 20);
            
            // Palabras clave de ejemplo
            const keywords = ['ansiedad', 'preocupado', 'estres', 'triste', 'nervioso'];
            const selectedKeywords = [keywords[Math.floor(Math.random() * keywords.length)]];
            
            // ✅ CORREGIDO: Crear chat con estructura válida para el nuevo modelo
            const chat = {
                user: patientId, // ✅ CORREGIDO: usar 'user' en lugar de 'userId'
                title: `Conversación ${i + 1}`,
                riskLevel: riskLevel, // ✅ CORREGIDO: usar valor válido del enum
                riskScore: riskScore,
                analysis: {
                    keywordAnalysis: { // ✅ CORREGIDO: estructura correcta del análisis
                        riskLevel: riskLevel,
                        riskScore: riskScore,
                        detectedKeywords: selectedKeywords.map(keyword => ({
                            keyword: keyword,
                            symptom: 'ansiedad',
                            weight: Math.floor(Math.random() * 5) + 1,
                            context: `El usuario mencionó sentirse ${keyword}`,
                            exactMatch: true
                        })),
                        summary: `El usuario expresó sentirse ${selectedKeywords[0]}`,
                        totalWeight: selectedKeywords.length * 3,
                        weightPercentage: Math.min(100, selectedKeywords.length * 20)
                    }
                },
                messages: [
                    {
                        role: 'user',
                        content: `Hola, me siento ${selectedKeywords[0]} hoy.`,
                        timestamp: chatDate
                    },
                    {
                        role: 'assistant', 
                        content: `Entiendo que te sientes ${selectedKeywords[0]}. ¿Quieres hablar más sobre eso?`,
                        timestamp: new Date(chatDate.getTime() + 5 * 60000)
                    }
                ],
                isActive: true,
                institution: expert.institution, // ✅ AGREGAR: institución del experto
                createdAt: chatDate,
                updatedAt: chatDate
            };
            
            sampleChats.push(chat);
        }

        console.log(`📝 Insertando ${sampleChats.length} chats...`);

        // Insertar usando el modelo Chat
        const result = await Chat.insertMany(sampleChats);
        
        console.log(`✅ ÉXITO: ${result.length} chats creados`);

        // ✅ ACTUALIZAR: Actualizar el perfil del paciente con el nuevo análisis
        await User.findByIdAndUpdate(patientId, {
            'patientProfile.lastRiskAssessment': {
                riskLevel: 'medio', // Riesgo promedio de los chats generados
                riskScore: 45,
                assessedAt: new Date(),
                keywordsDetected: sampleChats.reduce((total, chat) => total + chat.analysis.keywordAnalysis.detectedKeywords.length, 0)
            },
            'patientProfile.lastEvaluation': new Date()
        });

        res.json({
            success: true,
            message: `Se generaron ${result.length} chats de ejemplo para ${patient.name}`,
            data: {
                patient: {
                    _id: patient._id,
                    name: patient.name,
                    email: patient.email
                },
                chatsGenerated: result.length,
                sampleData: {
                    riskLevels: sampleChats.map(chat => chat.riskLevel),
                    totalKeywords: sampleChats.reduce((total, chat) => total + chat.analysis.keywordAnalysis.detectedKeywords.length, 0),
                    dateRange: {
                        from: sampleChats[sampleChats.length - 1]?.createdAt,
                        to: sampleChats[0]?.createdAt
                    }
                }
            }
        });

    } catch (error) {
        console.error('❌ ERROR en generateSampleData:', error);
        res.status(500).json({
            success: false,
            message: 'Error generando datos: ' + error.message,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
},

createTestChat: async (req, res) => {
    try {
        const expert = req.user;
        const { patientId } = req.params;
        const { message } = req.body;

        console.log('🧪 CREANDO CHAT DE PRUEBA para:', patientId);

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos'
            });
        }

        // ✅ MEJORADO: Verificar que el paciente pertenece al experto
        const patient = await User.findOne({
            _id: patientId,
            'patientProfile.assignedExpert': expert._id
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado o no tienes acceso'
            });
        }

        // ✅ CORREGIDO: Crear un chat con estructura válida para el nuevo modelo
        const testChat = new Chat({
            user: patientId, // ✅ CORREGIDO: usar 'user' en lugar de 'userId'
            title: 'Chat de prueba - ' + new Date().toLocaleDateString(),
            riskLevel: 'alto', // ✅ CORREGIDO: usar valor válido del enum
            riskScore: 85,
            analysis: {
                keywordAnalysis: { // ✅ CORREGIDO: estructura correcta del análisis
                    riskLevel: 'alto',
                    riskScore: 85,
                    detectedKeywords: [
                        {
                            keyword: 'ansiedad',
                            symptom: 'ansiedad',
                            weight: 4,
                            context: message || 'Estoy muy ansioso y preocupado por todo',
                            exactMatch: true
                        },
                        {
                            keyword: 'preocupado',
                            symptom: 'ansiedad', 
                            weight: 3,
                            context: message || 'Estoy muy ansioso y preocupado por todo',
                            exactMatch: true
                        }
                    ],
                    summary: 'El usuario mostró signos de ansiedad aguda con múltiples palabras clave de alto riesgo',
                    totalWeight: 7,
                    weightPercentage: 70
                }
            },
            messages: [
                {
                    role: 'user',
                    content: message || 'Estoy muy ansioso y preocupado por todo, no sé qué hacer',
                    timestamp: new Date()
                },
                {
                    role: 'assistant',
                    content: 'Entiendo que te sientes ansioso y preocupado. Estoy aquí para ayudarte. ¿Puedes contarme más sobre lo que te está causando esta ansiedad?',
                    timestamp: new Date(Date.now() + 60000)
                }
            ],
            isActive: true,
            institution: expert.institution, // ✅ AGREGAR: institución del experto
            lastRiskAssessment: new Date()
        });

        await testChat.save();
        
        console.log('✅ Chat de prueba creado:', testChat._id);

        // ✅ ACTUALIZAR: Actualizar el perfil del paciente
        await User.findByIdAndUpdate(patientId, {
            'patientProfile.lastRiskAssessment': {
                riskLevel: 'alto',
                riskScore: 85,
                assessedAt: new Date(),
                keywordsDetected: 2,
                chatId: testChat._id
            },
            'patientProfile.lastEvaluation': new Date()
        });

        res.json({
            success: true,
            message: 'Chat de prueba creado exitosamente',
            data: {
                chatId: testChat._id,
                patient: {
                    _id: patient._id,
                    name: patient.name,
                    email: patient.email
                },
                analysis: {
                    riskLevel: testChat.riskLevel,
                    riskScore: testChat.riskScore,
                    keywordsDetected: testChat.analysis.keywordAnalysis.detectedKeywords.length
                }
            }
        });

    } catch (error) {
        console.error('❌ Error creando chat de prueba:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando chat de prueba: ' + error.message,
            error: error.message,
            details: error.errors ? Object.keys(error.errors) : undefined
        });
    }
},

analyzePatient: async (req, res) => {
    try {
        const expert = req.user;
        const { patientId } = req.params;

        console.log('🔍 SOLICITUD DE ANÁLISIS para paciente:', patientId);

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para analizar pacientes'
            });
        }

        // Verificar que el paciente pertenece al experto
        const patient = await User.findOne({
            _id: patientId,
            'patientProfile.assignedExpert': expert._id
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado o no tienes acceso'
            });
        }

        // ✅ CORREGIDO: Buscar chats del paciente
        const chats = await Chat.find({ 
            user: patientId,
            isActive: true 
        }).sort({ createdAt: -1 });

        console.log(`📊 Conversaciones encontradas: ${chats.length}`);

        if (chats.length === 0) {
            return res.json({
                success: true,
                message: 'El paciente no tiene conversaciones para analizar',
                data: {
                    patient: {
                        _id: patient._id,
                        name: patient.name,
                        email: patient.email
                    },
                    analysis: {
                        overallRiskLevel: 'minimo',
                        averageRiskScore: 0,
                        totalChats: 0,
                        highRiskChats: 0,
                        totalKeywordsDetected: 0,
                        summary: 'No hay conversaciones para analizar'
                    }
                }
            });
        }

        // Análisis simplificado
        let totalRiskScore = 0;
        let highRiskCount = 0;
        let detectedKeywords = [];
        let frequentKeywords = {};

        chats.forEach(chat => {
            if (chat.riskScore) {
                totalRiskScore += chat.riskScore;
            }
            if (chat.riskLevel === 'alto' || chat.riskLevel === 'critico') {
                highRiskCount++;
            }
            
            // Acumular palabras clave
            if (chat.analysis?.keywordAnalysis?.detectedKeywords) {
                chat.analysis.keywordAnalysis.detectedKeywords.forEach(kw => {
                    detectedKeywords.push(kw);
                    frequentKeywords[kw.keyword] = (frequentKeywords[kw.keyword] || 0) + 1;
                });
            }
        });

        const averageRiskScore = chats.length > 0 ? Math.round(totalRiskScore / chats.length) : 0;
        const overallRiskLevel = expertController.scoreToRiskLevel(averageRiskScore);

        // Convertir palabras frecuentes a array ordenado
        const frequentKeywordsArray = Object.entries(frequentKeywords)
            .map(([keyword, count]) => ({ keyword, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // ✅ ACTUALIZAR: Actualizar el perfil del paciente
        await User.findByIdAndUpdate(patientId, {
            'patientProfile.lastRiskAssessment': {
                riskLevel: overallRiskLevel,
                riskScore: averageRiskScore,
                assessedAt: new Date(),
                keywordsDetected: detectedKeywords.length
            },
            'patientProfile.riskLevel': overallRiskLevel,
            'patientProfile.lastEvaluation': new Date()
        });

        // Respuesta inmediata
        res.json({
            success: true,
            message: 'Análisis completado exitosamente',
            data: {
                patient: {
                    _id: patient._id,
                    name: patient.name,
                    email: patient.email
                },
                analysis: {
                    overallRiskLevel,
                    averageRiskScore,
                    totalChats: chats.length,
                    highRiskChats: highRiskCount,
                    totalKeywordsDetected: detectedKeywords.length,
                    frequentKeywords: frequentKeywordsArray,
                    summary: `Se analizaron ${chats.length} conversaciones. ${highRiskCount} chats de alto riesgo detectados.`,
                    riskTrend: 'stable',
                    activityDays: chats.length > 0 ? 1 : 0
                },
                debug: {
                    queryUsed: { user: patientId, isActive: true },
                    chatIds: chats.map(chat => chat._id).slice(0, 3)
                }
            }
        });

    } catch (error) {
        console.error('❌ Error en analyzePatient:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor durante el análisis',
            error: error.message
        });
    }
},

debugPatientAnalysis: async (req, res) => {
    try {
        const { patientId } = req.params;
        
        console.log('🔍 DEBUG ANALYZE para paciente:', patientId);

        // Verificar paciente
        const patient = await User.findById(patientId);
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado'
            });
        }

        // Contar conversaciones con el campo CORREGIDO 'user'
        const chatCount = await Chat.countDocuments({ 
            user: patientId,
            isActive: true 
        });

        // Obtener algunos chats de ejemplo
        const chats = await Chat.find({ 
            user: patientId,
            isActive: true 
        }).limit(3);

        console.log(`📊 DEBUG: ${chatCount} chats encontrados para ${patient.name}`);

        res.json({
            success: true,
            data: {
                patient: {
                    name: patient.name,
                    email: patient.email,
                    _id: patient._id
                },
                chatCount,
                hasChats: chatCount > 0,
                sampleChats: chats.map(chat => ({
                    id: chat._id,
                    title: chat.title,
                    messageCount: chat.messages?.length || 0,
                    riskLevel: chat.riskLevel,
                    createdAt: chat.createdAt
                })),
                queryUsed: { user: patientId, isActive: true }
            }
        });

    } catch (error) {
        console.error('❌ Error en debug analysis:', error);
        res.status(500).json({
            success: false,
            message: 'Error en debug',
            error: error.message
        });
    }
},


// ✅ AGREGAR también este helper si no existe:
scoreToRiskLevel: (score) => {
    if (score >= 80) return 'critico';
    if (score >= 60) return 'alto';
    if (score >= 30) return 'medio';
    if (score >= 10) return 'bajo';
    return 'minimo';
},

getPatientChatsDebug: async (req, res) => {
    try {
        const expert = req.user;
        const { patientId } = req.params;

        console.log('🔍 DEBUG: Buscando chats para paciente:', patientId);

        const chats = await Chat.find({ user: patientId })
            .select('_id createdAt riskLevel riskScore analysis messages')
            .sort({ createdAt: -1 })
            .limit(10);

        console.log(`📊 DEBUG: Encontrados ${chats.length} chats`);

        // Mostrar estructura de cada chat
        const chatStructures = chats.map(chat => ({
            _id: chat._id,
            createdAt: chat.createdAt,
            riskLevel: chat.riskLevel,
            riskScore: chat.riskScore,
            hasAnalysis: !!chat.analysis,
            analysisStructure: chat.analysis ? {
                hasKeywords: !!chat.analysis.keywords,
                keywords: chat.analysis.keywords,
                hasSymptom: !!chat.analysis.symptom,
                symptom: chat.analysis.symptom
            } : null,
            messageCount: chat.messages ? chat.messages.length : 0,
            firstMessage: chat.messages && chat.messages.length > 0 ? 
                chat.messages[0].content.substring(0, 50) + '...' : 'No messages'
        }));

        res.json({
            success: true,
            data: {
                totalChats: chats.length,
                chatStructures,
                rawCount: await Chat.countDocuments({ user: patientId })
            }
        });

    } catch (error) {
        console.error('❌ Error en debug de chats:', error);
        res.status(500).json({
            success: false,
            message: 'Error en debug',
            error: error.message
        });
    }
},

// ✅ NUEVO: Helper para obtener palabras clave más frecuentes
getMostFrequentKeywords: (keywords, limit = 5) => {
    const frequency = {};
    keywords.forEach(keyword => {
        frequency[keyword] = (frequency[keyword] || 0) + 1;
    });
    
    return Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([keyword, count]) => ({ keyword, count }));
},

// ✅ NUEVO: Calcular indicador de ánimo
calculateMoodIndicator: (riskScore) => {
    if (!riskScore) return 'neutral';
    if (riskScore >= 70) return 'very_poor';
    if (riskScore >= 50) return 'poor';
    if (riskScore >= 30) return 'neutral';
    if (riskScore >= 10) return 'good';
    return 'very_good';
},

// ✅ NUEVO: Calcular nivel de actividad
calculateActivityLevel: (chatCount) => {
    if (chatCount >= 5) return 'high';
    if (chatCount >= 2) return 'medium';
    if (chatCount >= 1) return 'low';
    return 'none';
},

// ✅ NUEVO: Rellenar días faltantes en el reporte
fillMissingDays: (reports, startDate, endDate) => {
    const completeReport = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const existingReport = reports.find(r => r.date === dateStr);
        
        if (existingReport) {
            completeReport.push(existingReport);
        } else {
            completeReport.push({
                date: dateStr,
                totalChats: 0,
                highRiskChats: 0,
                mediumRiskChats: 0,
                avgRiskScore: 0,
                maxRiskScore: 0,
                keywordStats: {
                    total: 0,
                    unique: 0,
                    mostFrequent: []
                },
                moodIndicator: 'neutral',
                activityLevel: 'none'
            });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return completeReport;
},

// ✅ NUEVO: Generar resumen semanal
generateWeeklySummary: (dailyReports) => {
    const totalChats = dailyReports.reduce((sum, day) => sum + day.totalChats, 0);
    const highRiskChats = dailyReports.reduce((sum, day) => sum + day.highRiskChats, 0);
    const avgRiskScore = dailyReports.reduce((sum, day) => sum + day.avgRiskScore, 0) / dailyReports.length;
    
    // Calcular tendencia
    const firstHalf = dailyReports.slice(0, Math.floor(dailyReports.length / 2));
    const secondHalf = dailyReports.slice(Math.floor(dailyReports.length / 2));
    
    const firstHalfAvg = firstHalf.reduce((sum, day) => sum + day.avgRiskScore, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, day) => sum + day.avgRiskScore, 0) / secondHalf.length;
    
    let trend = 'stable';
    if (secondHalfAvg > firstHalfAvg + 10) trend = 'increasing';
    else if (secondHalfAvg < firstHalfAvg - 10) trend = 'decreasing';
    
    return {
        totalChats,
        highRiskChats,
        avgRiskScore: Math.round(avgRiskScore),
        riskTrend: trend,
        activityDays: dailyReports.filter(day => day.totalChats > 0).length,
        highRiskDays: dailyReports.filter(day => day.highRiskChats > 0).length
    };
},

// ✅ NUEVO: Obtener pacientes con filtros avanzados
getMyPatientsAdvanced: async (req, res) => {
    try {
        const expert = req.user;
        const { 
            page = 1, 
            limit = 50, 
            riskLevel, 
            search, 
            programId,
            grade,
            department,
            status = 'active'
        } = req.query;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver pacientes'
            });
        }

        // Obtener información de la institución para aplicar filtros correctos
        const institution = await Institution.findById(expert.institution);
        const institutionType = institution?.type || 'university';

        // Construir filtro avanzado
        const filter = {
            'patientProfile.assignedExpert': expert._id,
            role: 'user'
        };

        // Filtrar por estado
        if (status === 'active') {
            filter.isActive = true;
        } else if (status === 'inactive') {
            filter.isActive = false;
        }

        // ✅ CORREGIDO: Aplicar filtros específicos por tipo de institución
        switch (institutionType) {
            case 'university':
                // ✅ UNIVERSIDAD: Solo filtrar por programa
                if (programId && programId !== 'all') {
                    filter['institutionalPath.program'] = programId;
                }
                break;

            case 'school':
                // ✅ COLEGIO: Solo filtrar por grado
                if (grade && grade !== 'all') {
                    filter['institutionalPath.grade'] = grade;
                }
                break;

            case 'company':
                // ✅ EMPRESA: Filtrar por departamento
                if (department && department !== 'all') {
                    filter['institutionalPath.department'] = department;
                }
                break;

            case 'health_center':
                // ✅ CENTRO DE SALUD: Filtrar por departamento
                if (department && department !== 'all') {
                    filter['institutionalPath.department'] = department;
                }
                break;

            default:
                // Institución genérica: filtrar por departamento
                if (department && department !== 'all') {
                    filter['institutionalPath.department'] = department;
                }
        }

        // Filtrar por nivel de riesgo
        if (riskLevel && riskLevel !== 'all') {
            filter['patientProfile.riskLevel'] = riskLevel;
        }

        // Búsqueda por nombre o email
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        console.log('🔍 Filtros aplicados:', {
            institutionType: institutionType,
            filters: filter
        });

        const patients = await User.find(filter)
            .populate('institutionalPath.program', 'name')
            .populate('institutionalPath.faculty', 'name')
            .populate('institutionalPath.career', 'name')
            .populate('institution', 'name type')
            .select('-password')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        // Obtener estadísticas de chats para cada paciente
        const patientsWithStats = await Promise.all(
            patients.map(async (patient) => {
                const stats = await Chat.aggregate([
                    { $match: { user: patient._id } },
                    {
                        $group: {
                            _id: null,
                            totalChats: { $sum: 1 },
                            highRiskChats: {
                                $sum: {
                                    $cond: [{ $eq: ['$riskLevel', 'high'] }, 1, 0]
                                }
                            },
                            lastActivity: { $max: '$createdAt' }
                        }
                    }
                ]);

                const patientObj = patient.toObject();
                patientObj.stats = stats[0] || {
                    totalChats: 0,
                    highRiskChats: 0,
                    lastActivity: null
                };

                return patientObj;
            })
        );

        const total = await User.countDocuments(filter);

        // ✅ CORREGIDO: Obtener opciones de filtro según el tipo de institución
        let availableFilters = {};
        switch (institutionType) {
            case 'university':
                availableFilters.availablePrograms = await Program.find({ 
                    institution: expert.institution 
                }).select('name _id');
                break;

            case 'school':
                // Obtener grados únicos de los pacientes
                const gradeResults = await User.aggregate([
                    {
                        $match: {
                            'patientProfile.assignedExpert': expert._id,
                            'institutionalPath.grade': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: '$institutionalPath.grade'
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);
                availableFilters.availableGrades = gradeResults.map(g => g._id).filter(Boolean);
                break;

            case 'company':
            case 'health_center':
                // Obtener departamentos únicos de los pacientes
                const deptResults = await User.aggregate([
                    {
                        $match: {
                            'patientProfile.assignedExpert': expert._id,
                            'institutionalPath.department': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: '$institutionalPath.department'
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);
                availableFilters.availableDepartments = deptResults.map(d => d._id).filter(Boolean);
                break;
        }

        res.json({
            success: true,
            data: {
                patients: patientsWithStats,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total
                },
                filters: {
                    ...availableFilters,
                    riskLevels: ['minimo', 'bajo', 'medio', 'alto', 'critico']
                },
                institutionType: institutionType
            }
        });

    } catch (error) {
        console.error('Error obteniendo pacientes:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

checkNewPatients: async (req, res) => {
    try {
        const expert = req.user;
        const { lastCheck } = req.query;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos'
            });
        }

        const filter = {
            'patientProfile.assignedExpert': expert._id,
            isActive: true,
            role: 'user'
        };

        // Si se proporciona una fecha de última verificación, filtrar pacientes nuevos
        if (lastCheck) {
            filter.createdAt = { $gt: new Date(lastCheck) };
        }

        const newPatients = await User.find(filter)
            .populate('institutionalPath.program', 'name')
            .populate('institutionalPath.faculty', 'name')
            .select('name email institutionalPath patientProfile createdAt')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            success: true,
            data: {
                newPatients,
                totalNew: newPatients.length,
                currentTime: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error verificando nuevos pacientes:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

// ✅ NUEVO: Obtener actualizaciones en tiempo real
getRealTimeUpdates: async (req, res) => {
    try {
        const expert = req.user;
        const { lastCheck } = req.query;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos'
            });
        }

        const currentTime = new Date();
        const lastCheckDate = lastCheck ? new Date(lastCheck) : new Date(currentTime.getTime() - 5 * 60 * 1000); // Últimos 5 minutos por defecto

        // Obtener nuevos pacientes
        const newPatients = await User.find({
            'patientProfile.assignedExpert': expert._id,
            createdAt: { $gt: lastCheckDate },
            role: 'user'
        })
        .populate('institutionalPath.program', 'name')
        .select('name email institutionalPath patientProfile createdAt')
        .sort({ createdAt: -1 });

        // Obtener chats de alto riesgo recientes
        const highRiskChats = await Chat.aggregate([
            {
                $match: {
                    createdAt: { $gt: lastCheckDate },
                    riskLevel: 'high'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'patient'
                }
            },
            {
                $unwind: '$patient'
            },
            {
                $match: {
                    'patient.patientProfile.assignedExpert': expert._id
                }
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    riskLevel: 1,
                    riskScore: 1,
                    createdAt: 1,
                    'patient.name': 1,
                    'patient._id': 1
                }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 10 }
        ]);

        res.json({
            success: true,
            data: {
                newPatients,
                highRiskChats,
                lastCheck: lastCheckDate.toISOString(),
                currentTime: currentTime.toISOString(),
                updates: {
                    newPatientsCount: newPatients.length,
                    highRiskChatsCount: highRiskChats.length
                }
            }
        });

    } catch (error) {
        console.error('Error obteniendo actualizaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

getAdvancedDashboardStats: async (req, res) => {
    try {
        const expert = req.user;
        const { days = 30 } = req.query;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver estadísticas'
            });
        }

        // ✅ Obtener IDs de pacientes del experto
        const expertPatientIds = await expertController.getExpertPatientIds(expert._id);

        // ✅ Obtener información de la institución del experto
        const institution = await Institution.findById(expert.institution);
        const institutionType = institution?.type || 'unknown';

        console.log('🏢 Tipo de institución detectado:', institutionType);

        // ✅ Estadísticas básicas de pacientes
        const patientStats = await User.aggregate([
            {
                $match: {
                    '_id': { $in: expertPatientIds },
                    isActive: true,
                    role: 'user'
                }
            },
            {
                $group: {
                    _id: null,
                    totalPatients: { $sum: 1 },
                    activePatients: { 
                        $sum: { 
                            $cond: [{ $eq: ['$patientProfile.status', 'active'] }, 1, 0] 
                        } 
                    }
                }
            }
        ]);

        // ✅ Distribución por nivel de ansiedad (COMMON para todos los tipos)
        const anxietyLevelDistribution = await User.aggregate([
            {
                $match: {
                    '_id': { $in: expertPatientIds },
                    isActive: true,
                    role: 'user',
                    'patientProfile.riskLevel': { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$patientProfile.riskLevel',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // ✅ DISTRIBUCIÓN POR TIPO DE INSTITUCIÓN
        let institutionalDistribution = {};
        
        switch (institutionType) {
            case 'university':
                // ✅ UNIVERSIDAD: Facultades y Programas
                institutionalDistribution.byFaculty = await User.aggregate([
                    {
                        $match: {
                            '_id': { $in: expertPatientIds },
                            isActive: true,
                            role: 'user',
                            'institutionalPath.faculty': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $lookup: {
                            from: 'faculties',
                            localField: 'institutionalPath.faculty',
                            foreignField: '_id',
                            as: 'facultyInfo'
                        }
                    },
                    {
                        $unwind: '$facultyInfo'
                    },
                    {
                        $group: {
                            _id: '$facultyInfo.name',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } },
                    { $limit: 10 }
                ]);

                institutionalDistribution.byProgram = await User.aggregate([
                    {
                        $match: {
                            '_id': { $in: expertPatientIds },
                            isActive: true,
                            role: 'user',
                            'institutionalPath.program': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $lookup: {
                            from: 'programs',
                            localField: 'institutionalPath.program',
                            foreignField: '_id',
                            as: 'programInfo'
                        }
                    },
                    {
                        $unwind: '$programInfo'
                    },
                    {
                        $group: {
                            _id: '$programInfo.name',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } },
                    { $limit: 10 }
                ]);
                break;

            case 'school':
    // ✅ COLEGIO: Grados y Secciones
    institutionalDistribution.byGrade = await User.aggregate([
        {
            $match: {
                '_id': { $in: expertPatientIds },
                isActive: true,
                role: 'user',
                'institutionalPath.grade': { $exists: true, $ne: null }
            }
        },
        {
            $group: {
                _id: '$institutionalPath.grade',
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } } // ✅ ORDENAR POR GRADO (1, 2, 3...)
    ]);

    institutionalDistribution.bySection = await User.aggregate([
        {
            $match: {
                '_id': { $in: expertPatientIds },
                isActive: true,
                role: 'user',
                'institutionalPath.section': { $exists: true, $ne: null }
            }
        },
        {
            $group: {
                _id: '$institutionalPath.section',
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } } // ✅ ORDENAR ALFABÉTICAMENTE (A, B, C...)
    ]);
    break;

            case 'company':
                // ✅ EMPRESA: Departamentos y Cargos
                institutionalDistribution.byDepartment = await User.aggregate([
                    {
                        $match: {
                            '_id': { $in: expertPatientIds },
                            isActive: true,
                            role: 'user',
                            'institutionalPath.department': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: '$institutionalPath.department',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } }
                ]);

                institutionalDistribution.byPosition = await User.aggregate([
                    {
                        $match: {
                            '_id': { $in: expertPatientIds },
                            isActive: true,
                            role: 'user',
                            'institutionalPath.course': { $exists: true, $ne: null } // course se usa como position
                        }
                    },
                    {
                        $group: {
                            _id: '$institutionalPath.course',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } }
                ]);
                break;

            case 'health_center':
                // ✅ CENTRO DE SALUD: Departamentos y Especialidades
                institutionalDistribution.byDepartment = await User.aggregate([
                    {
                        $match: {
                            '_id': { $in: expertPatientIds },
                            isActive: true,
                            role: 'user',
                            'institutionalPath.department': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: '$institutionalPath.department',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } }
                ]);

                institutionalDistribution.bySpecialty = await User.aggregate([
                    {
                        $match: {
                            '_id': { $in: expertPatientIds },
                            isActive: true,
                            role: 'user',
                            'institutionalPath.course': { $exists: true, $ne: null } // course se usa como specialty
                        }
                    },
                    {
                        $group: {
                            _id: '$institutionalPath.course',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } }
                ]);
                break;

            default:
                // ✅ INSTITUCIÓN GENÉRICA: Departamentos y Cursos
                institutionalDistribution.byDepartment = await User.aggregate([
                    {
                        $match: {
                            '_id': { $in: expertPatientIds },
                            isActive: true,
                            role: 'user',
                            'institutionalPath.department': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: '$institutionalPath.department',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } }
                ]);

                institutionalDistribution.byCourse = await User.aggregate([
                    {
                        $match: {
                            '_id': { $in: expertPatientIds },
                            isActive: true,
                            role: 'user',
                            'institutionalPath.course': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: '$institutionalPath.course',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } }
                ]);
        }

        // ✅ Estadísticas de actividad reciente (COMMON para todos)
        const recentActivity = await Chat.aggregate([
            {
                $match: {
                    'user': { $in: expertPatientIds },
                    'createdAt': { 
                        $gte: new Date(new Date().setDate(new Date().getDate() - parseInt(days)))
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    chatCount: { $sum: 1 },
                    highRiskCount: {
                        $sum: { $cond: [{ $in: ['$riskLevel', ['alto', 'critico']] }, 1, 0] }
                    }
                }
            },
            { $sort: { _id: 1 } },
            { $limit: 15 }
        ]);

        const stats = patientStats[0] || { totalPatients: 0, activePatients: 0 };

        res.json({
            success: true,
            data: {
                institutionType: institutionType,
                institutionName: institution?.name || 'Institución',
                basicStats: {
                    totalPatients: stats.totalPatients,
                    activePatients: stats.activePatients,
                    inactivePatients: stats.totalPatients - stats.activePatients
                },
                distributions: {
                    byInstitutionType: institutionalDistribution,
                    byAnxietyLevel: anxietyLevelDistribution
                },
                recentActivity: recentActivity,
                lastUpdated: new Date()
            }
        });

    } catch (error) {
        console.error('Error obteniendo estadísticas avanzadas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

getPatientsByGrade: async (req, res) => {
    try {
        const expert = req.user;
        
        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos'
            });
        }

        console.log('📊 Obteniendo pacientes por grado para experto:', expert._id);

        // Obtener IDs de pacientes del experto
        const expertPatientIds = await expertController.getExpertPatientIds(expert._id);
        
        if (expertPatientIds.length === 0) {
            return res.json({
                success: true,
                data: []
            });
        }

        // Agregación para obtener pacientes por grado
        const patientsByGrade = await User.aggregate([
            {
                $match: {
                    _id: { $in: expertPatientIds },
                    isActive: true,
                    role: 'user',
                    'institutionalPath.grade': { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$institutionalPath.grade',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 } // Ordenar por grado (1, 2, 3...)
            }
        ]);

        console.log('📚 Pacientes por grado encontrados:', patientsByGrade);

        res.json({
            success: true,
            data: patientsByGrade
        });

    } catch (error) {
        console.error('Error obteniendo pacientes por grado:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

getPatientsBySection: async (req, res) => {
    try {
        const expert = req.user;
        
        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos'
            });
        }

        console.log('📊 Obteniendo pacientes por sección para experto:', expert._id);

        // Obtener IDs de pacientes del experto
        const expertPatientIds = await expertController.getExpertPatientIds(expert._id);
        
        if (expertPatientIds.length === 0) {
            return res.json({
                success: true,
                data: []
            });
        }

        // Agregación para obtener pacientes por sección
        const patientsBySection = await User.aggregate([
            {
                $match: {
                    _id: { $in: expertPatientIds },
                    isActive: true,
                    role: 'user',
                    'institutionalPath.section': { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$institutionalPath.section',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 } // Ordenar alfabéticamente (A, B, C...)
            }
        ]);

        console.log('👥 Pacientes por sección encontrados:', patientsBySection);

        res.json({
            success: true,
            data: patientsBySection
        });

    } catch (error) {
        console.error('Error obteniendo pacientes por sección:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

debugPatientData: async (req, res) => {
    try {
        const expert = req.user;
        
        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos'
            });
        }

        // Obtener todos los pacientes del experto con sus datos institucionales
        const patients = await User.find({
            'patientProfile.assignedExpert': expert._id,
            isActive: true,
            role: 'user'
        })
        .select('name email institutionalPath')
        .lean();

        // Filtrar pacientes de colegio
        const schoolPatients = patients.filter(patient => 
            patient.institutionalPath && 
            (patient.institutionalPath.grade || patient.institutionalPath.section)
        );

        console.log('🏫 PACIENTES DE COLEGIO (DEBUG):', schoolPatients);

        res.json({
            success: true,
            data: {
                totalPatients: patients.length,
                schoolPatients: schoolPatients.length,
                patients: schoolPatients.map(p => ({
                    name: p.name,
                    grade: p.institutionalPath?.grade,
                    section: p.institutionalPath?.section,
                    semester: p.institutionalPath?.semester,
                    schedule: p.institutionalPath?.schedule
                }))
            }
        });

    } catch (error) {
        console.error('Error en debug:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

getRecentActivity: async (req, res) => {
    try {
        const expert = req.user;
        const { limit = 10 } = req.query;

        if (expert.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver actividad reciente'
            });
        }

        // Obtener IDs de pacientes del experto
        const expertPatientIds = await expertController.getExpertPatientIds(expert._id);

        if (expertPatientIds.length === 0) {
            return res.json({
                success: true,
                data: {
                    activities: [],
                    message: 'No hay pacientes asignados'
                }
            });
        }

        // Obtener chats recientes de los pacientes
        const recentChats = await Chat.find({
            user: { $in: expertPatientIds },
            isActive: true
        })
        .populate('user', 'name email')
        .select('user riskLevel riskScore createdAt analysis')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();

        // Obtener pacientes recién creados
        const recentPatients = await User.find({
            'patientProfile.assignedExpert': expert._id,
            isActive: true,
            role: 'user',
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Últimos 7 días
        })
        .select('name email createdAt institutionalPath')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

        // ✅ CORREGIDO: Función local para obtener etiqueta de riesgo
        const getRiskLabel = (riskLevel) => {
            const labels = {
                'critico': 'Crítico',
                'alto': 'Alto',
                'medio': 'Medio',
                'bajo': 'Bajo', 
                'minimo': 'Mínimo'
            };
            return labels[riskLevel] || 'Sin evaluar';
        };

        // Formatear actividades
        const activities = [];

        // Agregar chats recientes como actividades
        recentChats.forEach(chat => {
            if (chat.user) {
                activities.push({
                    type: 'chat',
                    icon: '💬',
                    title: `Nueva conversación de ${chat.user.name}`,
                    description: `Nivel de riesgo: ${getRiskLabel(chat.riskLevel || 'minimo')}`, // ✅ CORREGIDO
                    user: chat.user.name,
                    email: chat.user.email,
                    riskLevel: chat.riskLevel,
                    riskScore: chat.riskScore,
                    date: chat.createdAt,
                    metadata: {
                        keywordsDetected: chat.analysis?.keywordAnalysis?.detectedKeywords?.length || 0
                    }
                });
            }
        });

        // Agregar pacientes nuevos como actividades
        recentPatients.forEach(patient => {
            activities.push({
                type: 'patient',
                icon: '👤',
                title: `Nuevo paciente asignado`,
                description: `${patient.name} se unió al sistema`,
                user: patient.name,
                email: patient.email,
                date: patient.createdAt,
                metadata: {
                    program: patient.institutionalPath?.program?.name || 'No asignado'
                }
            });
        });

        // Ordenar actividades por fecha (más reciente primero)
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Limitar a la cantidad solicitada
        const limitedActivities = activities.slice(0, limit);

        res.json({
            success: true,
            data: {
                activities: limitedActivities,
                summary: {
                    totalActivities: limitedActivities.length,
                    recentChats: recentChats.length,
                    newPatients: recentPatients.length
                }
            }
        });

    } catch (error) {
        console.error('Error obteniendo actividad reciente:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
},

getRiskLabel(riskLevel) {
    const labels = {
        'critico': 'Crítico',
        'alto': 'Alto',
        'medio': 'Medio',
        'bajo': 'Bajo', 
        'minimo': 'Mínimo'
    };
    return labels[riskLevel] || 'Sin evaluar';
},

    // Helper para obtener IDs de pacientes del experto
    getExpertPatientIds: async (expertId) => {
    const patients = await User.find({
        'patientProfile.assignedExpert': expertId,
        isActive: true,
        role: 'user'
    }).select('_id');
    
    return patients.map(p => p._id);
}



    
};

module.exports = expertController;