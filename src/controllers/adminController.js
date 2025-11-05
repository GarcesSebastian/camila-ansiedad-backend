const User = require('../models/User');
const Chat = require('../models/Chat');
const Recommendation = require('../models/Recommendation');
const Institution = require('../models/Institution');
const Program = require('../models/Program');
const Faculty = require('../models/Faculty');
const Career = require('../models/Career');
const bcrypt = require('bcryptjs');

const adminController = {
    // Crear usuario experto asignado a institución
createExpert: async (req, res) => {
    try {
        console.log('📝 Solicitando creación de experto:', req.body);
        
        if (req.user.role !== 'superadmin' && req.user.role !== 'institutional_admin') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para esta acción'
            });
        }

        const { 
            name, 
            email, 
            password, 
            specialization, 
            licenseNumber, 
            yearsOfExperience, 
            bio,
            institutionId,
            assignedPrograms,
            assignedFaculties,
            assignedCareers
        } = req.body;

        console.log('📧 Datos recibidos:', { name, email, institutionId });

        // Validar campos requeridos
        if (!name || !email || !password || !specialization) {
            return res.status(400).json({
                success: false,
                message: 'Nombre, email, contraseña y especialización son campos requeridos'
            });
        }

        // Verificar si el email ya existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'El email ya está registrado'
            });
        }

        // Para admins institucionales, usar su propia institución
        let targetInstitutionId = institutionId;
        if (req.user.role === 'institutional_admin') {
            targetInstitutionId = req.user.institution;
        }

        // Verificar que la institución existe si se proporciona
        if (targetInstitutionId) {
            const institution = await Institution.findById(targetInstitutionId);
            if (!institution) {
                return res.status(404).json({
                    success: false,
                    message: 'Institución no encontrada'
                });
            }
        }

        console.log('🔨 Creando usuario experto...');

        // Crear el usuario experto
        const expertUser = new User({
            name,
            email,
            password,
            role: 'expert',
            institution: targetInstitutionId,
            expertProfile: {
                specialization,
                licenseNumber: licenseNumber || '',
                yearsOfExperience: yearsOfExperience || 0,
                bio: bio || '',
                assignedPrograms: assignedPrograms || [],
                assignedFaculties: assignedFaculties || [],
                assignedCareers: assignedCareers || []
            }
        });

        await expertUser.save();
        console.log('✅ Experto creado en BD:', expertUser._id);

        // Populate para la respuesta
        const populatedExpert = await User.findById(expertUser._id)
            .populate('institution')
            .populate('expertProfile.assignedPrograms')
            .populate('expertProfile.assignedFaculties')
            .populate('expertProfile.assignedCareers')
            .select('-password');

        console.log('📤 Enviando respuesta...');

        res.status(201).json({
            success: true,
            message: 'Experto creado exitosamente',
            data: {
                user: populatedExpert
            }
        });

    } catch (error) {
        console.error('❌ Error creando experto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear el experto: ' + error.message
        });
    }
},

createPatient: async (req, res) => {
    try {
        console.log('📝 Solicitando creación de paciente:', req.body);
        
        // Verificar que el usuario es experto
        if (req.user.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'Solo los expertos pueden crear pacientes'
            });
        }

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
            grade, // Para colegio
            medicalHistory,
            emergencyContact
        } = req.body;

        console.log('📧 Datos recibidos:', { name, email });

        // Validar campos requeridos
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Nombre, email y contraseña son campos requeridos'
            });
        }

        // Verificar si el email ya existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'El email ya está registrado'
            });
        }

        console.log('🔨 Creando usuario paciente...');

        // Obtener información de la institución para validar campos requeridos
        const institution = await Institution.findById(req.user.institution);
        let institutionalData = {};

        // Configurar datos según el tipo de institución
        switch (institution?.type) {
            case 'university':
                if (!programId || !facultyId || !careerId || !semester) {
                    return res.status(400).json({
                        success: false,
                        message: 'Para universidades, programa, facultad, carrera y semestre son requeridos'
                    });
                }
                institutionalData = {
                    program: programId,
                    faculty: facultyId,
                    career: careerId,
                    semester: semester,
                    course: course || ''
                };
                break;

            case 'school':
                if (!grade) {
                    return res.status(400).json({
                        success: false,
                        message: 'Para colegios, el grado/curso es requerido'
                    });
                }
                institutionalData = {
                    course: grade,
                    semester: '' // Podría usarse para periodo académico
                };
                break;

            case 'company':
                if (!department) {
                    return res.status(400).json({
                        success: false,
                        message: 'Para empresas, el departamento es requerido'
                    });
                }
                institutionalData = {
                    department: department,
                    course: '' // Podría usarse para puesto
                };
                break;

            case 'health_center':
                institutionalData = {
                    department: department || '',
                    course: '' // Podría usarse para especialidad
                };
                break;

            default:
                institutionalData = {
                    department: department || '',
                    course: course || ''
                };
        }

        // Crear el usuario paciente
        const patientUser = new User({
            name,
            email,
            password,
            age: age || null,
            role: 'user',
            institution: req.user.institution,
            institutionalPath: institutionalData,
            patientProfile: {
                assignedExpert: req.user._id,
                medicalHistory: medicalHistory || '',
                emergencyContact: emergencyContact || '',
                status: 'active'
            }
        });

        await patientUser.save();
        console.log('✅ Paciente creado en BD:', patientUser._id);

        // Populate para la respuesta
        const populatedPatient = await User.findById(patientUser._id)
            .populate('institution')
            .populate('institutionalPath.program')
            .populate('institutionalPath.faculty')
            .populate('institutionalPath.career')
            .populate('patientProfile.assignedExpert')
            .select('-password');

        console.log('📤 Enviando respuesta...');

        res.status(201).json({
            success: true,
            message: 'Paciente creado exitosamente',
            data: {
                user: populatedPatient
            }
        });

    } catch (error) {
        console.error('❌ Error creando paciente:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear el paciente: ' + error.message
        });
    }
},

// Obtener pacientes asignados a un experto
getMyPatients: async (req, res) => {
    try {
        console.log('👥 Solicitando pacientes del experto:', req.user._id);
        
        // Verificar que el usuario es experto
        if (req.user.role !== 'expert') {
            return res.status(403).json({
                success: false,
                message: 'Solo los expertos pueden ver sus pacientes'
            });
        }

        const { page = 1, limit = 20, search = '' } = req.query;
        const skip = (page - 1) * limit;

        // Construir query para pacientes asignados a este experto
        let query = { 
            role: 'user',
            'patientProfile.assignedExpert': req.user._id,
            isActive: true
        };

        // Si hay búsqueda, agregar filtro por nombre o email
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        console.log('📋 Query de búsqueda:', query);

        const patients = await User.find(query)
            .select('-password')
            .populate('institution')
            .populate('institutionalPath.program')
            .populate('institutionalPath.faculty')
            .populate('institutionalPath.career')
            .populate('patientProfile.assignedExpert')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 })
            .lean();

        // Obtener estadísticas de ansiedad para cada paciente
        const patientsWithStats = await Promise.all(
            patients.map(async (patient) => {
                const chats = await Chat.find({ 
                    userId: patient._id, 
                    isActive: true 
                }).select('riskLevel riskScore anxietyIndicators createdAt');

                const totalChats = chats.length;
                const highRiskChats = chats.filter(chat => 
                    chat.riskLevel === 'ALTO' || chat.riskLevel === 'high'
                ).length;
                const lastChat = chats.length > 0 ? 
                    chats[chats.length - 1].createdAt : null;

                return {
                    ...patient,
                    stats: {
                        totalChats,
                        highRiskChats,
                        lastActivity: lastChat
                    }
                };
            })
        );

        const total = await User.countDocuments(query);

        console.log(`✅ ${patientsWithStats.length} pacientes encontrados`);

        res.json({
            success: true,
            data: {
                patients: patientsWithStats,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('❌ Error obteniendo pacientes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener los pacientes: ' + error.message
        });
    }
},

    // Obtener usuarios por institución y estructura
    getUsersByInstitution: async (req, res) => {
        try {
            const { programId, facultyId, careerId, semester, page = 1, limit = 20 } = req.query;
            
            // Construir query basado en permisos y filtros
            let query = { role: 'user', isActive: true };
            
            // Si es experto o admin institucional, solo ver usuarios de su institución
            if (req.user.role === 'expert' || req.user.role === 'institutional_admin') {
                query.institution = req.user.institution;
                
                // Para expertos, filtrar por áreas asignadas
                if (req.user.role === 'expert') {
                    const orConditions = [];
                    
                    if (req.user.expertProfile.assignedPrograms.length > 0) {
                        orConditions.push({ 'institutionalPath.program': { $in: req.user.expertProfile.assignedPrograms } });
                    }
                    if (req.user.expertProfile.assignedFaculties.length > 0) {
                        orConditions.push({ 'institutionalPath.faculty': { $in: req.user.expertProfile.assignedFaculties } });
                    }
                    if (req.user.expertProfile.assignedCareers.length > 0) {
                        orConditions.push({ 'institutionalPath.career': { $in: req.user.expertProfile.assignedCareers } });
                    }
                    
                    if (orConditions.length > 0) {
                        query.$or = orConditions;
                    }
                }
            }
            
            // Aplicar filtros específicos
            if (programId) query['institutionalPath.program'] = programId;
            if (facultyId) query['institutionalPath.faculty'] = facultyId;
            if (careerId) query['institutionalPath.career'] = careerId;
            if (semester) query['institutionalPath.semester'] = semester;

            const skip = (page - 1) * limit;

            const users = await User.find(query)
                .select('-password')
                .populate('institution')
                .populate('institutionalPath.program')
                .populate('institutionalPath.faculty')
                .populate('institutionalPath.career')
                .skip(skip)
                .limit(parseInt(limit))
                .lean();

            // Obtener estadísticas de ansiedad para cada usuario
            const usersWithStats = await Promise.all(
                users.map(async (user) => {
                    const chats = await Chat.find({ 
                        userId: user._id, 
                        isActive: true 
                    }).select('riskLevel riskScore anxietyIndicators createdAt');

                    const totalChats = chats.length;
                    const highRiskChats = chats.filter(chat => 
                        chat.riskLevel === 'ALTO' || chat.riskLevel === 'high'
                    ).length;
                    const lastChat = chats.length > 0 ? 
                        chats[chats.length - 1].createdAt : null;

                    // Calcular tendencia
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    
                    const recentChats = chats.filter(chat => 
                        chat.createdAt >= sevenDaysAgo
                    );
                    const recentHighRisk = recentChats.filter(chat => 
                        chat.riskLevel === 'ALTO' || chat.riskLevel === 'high'
                    ).length;

                    const trend = recentHighRisk > (highRiskChats - recentHighRisk) ? 'up' : 
                                 recentHighRisk < (highRiskChats - recentHighRisk) ? 'down' : 'stable';

                    return {
                        ...user,
                        stats: {
                            totalChats,
                            highRiskChats,
                            recentHighRisk,
                            lastActivity: lastChat,
                            trend
                        }
                    };
                })
            );

            const total = await User.countDocuments(query);

            res.json({
                success: true,
                data: {
                    users: usersWithStats,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });

        } catch (error) {
            console.error('Error obteniendo usuarios:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener los usuarios: ' + error.message
            });
        }
    },

    // Obtener análisis detallado de un usuario específico
    getUserAnalysis: async (req, res) => {
        try {
            const { userId } = req.params;
            const { startDate, endDate } = req.query;

            // Verificar permisos
            if (req.user.role !== 'superadmin' && req.user.role !== 'institutional_admin' && req.user.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para esta acción'
                });
            }

            // Para expertos y admins institucionales, verificar permisos sobre el usuario
            if (req.user.role === 'expert' || req.user.role === 'institutional_admin') {
                const targetUser = await User.findById(userId);
                if (!targetUser || targetUser.institution.toString() !== req.user.institution.toString()) {
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes permisos para ver este usuario'
                    });
                }

                // Para expertos, verificar asignación específica
                if (req.user.role === 'expert') {
                    const hasAccess = await checkExpertAccess(req.user, targetUser);
                    if (!hasAccess) {
                        return res.status(403).json({
                            success: false,
                            message: 'No tienes permisos para ver este usuario'
                        });
                    }
                }
            }

            const dateFilter = {};
            if (startDate && endDate) {
                dateFilter.createdAt = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            const chats = await Chat.find({
                userId,
                isActive: true,
                ...dateFilter
            }).sort({ createdAt: 1 });

            // Análisis semanal de emociones
            const weeklyAnalysis = chats.map(chat => ({
                date: chat.createdAt,
                message: chat.messages[0]?.content || '',
                riskLevel: chat.riskLevel,
                riskScore: chat.riskScore,
                indicators: chat.anxietyIndicators || {}
            }));

            // Estadísticas generales
            const totalChats = chats.length;
            const highRiskChats = chats.filter(chat => 
                chat.riskLevel === 'ALTO' || chat.riskLevel === 'high'
            ).length;
            const averageRiskScore = chats.length > 0 ? 
                chats.reduce((sum, chat) => sum + (chat.riskScore || 0), 0) / chats.length : 0;

            // Indicadores más comunes
            const indicators = {};
            chats.forEach(chat => {
                if (chat.anxietyIndicators) {
                    Object.keys(chat.anxietyIndicators).forEach(indicator => {
                        indicators[indicator] = (indicators[indicator] || 0) + 1;
                    });
                }
            });

            const commonIndicators = Object.entries(indicators)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([indicator, count]) => ({ indicator, count }));

            // Obtener recomendaciones existentes
            const recommendations = await Recommendation.find({
                userId,
                isActive: true
            }).populate('expertId', 'name expertProfile.specialization');

            // Obtener información del usuario
            const user = await User.findById(userId)
                .select('-password')
                .populate('institution')
                .populate('institutionalPath.program')
                .populate('institutionalPath.faculty')
                .populate('institutionalPath.career');

            res.json({
                success: true,
                data: {
                    user,
                    analysis: {
                        weeklyAnalysis,
                        statistics: {
                            totalChats,
                            highRiskChats,
                            averageRiskScore: Math.round(averageRiskScore * 10) / 10,
                            riskLevel: getOverallRiskLevel(averageRiskScore)
                        },
                        commonIndicators,
                        recommendations
                    }
                }
            });

        } catch (error) {
            console.error('Error en análisis de usuario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener el análisis: ' + error.message
            });
        }
    },

    // Agregar recomendación
    addRecommendation: async (req, res) => {
        try {
            const { userId, recommendation, priority = 'medium' } = req.body;

            // Verificar permisos
            if (req.user.role !== 'superadmin' && req.user.role !== 'institutional_admin' && req.user.role !== 'expert') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para esta acción'
                });
            }

            // Verificar permisos sobre el usuario
            const targetUser = await User.findById(userId);
            if (!targetUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            if (req.user.role === 'expert' || req.user.role === 'institutional_admin') {
                if (targetUser.institution.toString() !== req.user.institution.toString()) {
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes permisos para este usuario'
                    });
                }

                // Para expertos, verificar asignación específica
                if (req.user.role === 'expert') {
                    const hasAccess = await checkExpertAccess(req.user, targetUser);
                    if (!hasAccess) {
                        return res.status(403).json({
                            success: false,
                            message: 'No tienes permisos para este usuario'
                        });
                    }
                }
            }

            const recommendationDoc = new Recommendation({
                userId,
                expertId: req.user._id,
                institution: targetUser.institution,
                recommendation,
                priority
            });

            await recommendationDoc.save();

            res.status(201).json({
                success: true,
                message: 'Recomendación agregada exitosamente',
                data: {
                    recommendation: recommendationDoc
                }
            });

        } catch (error) {
            console.error('Error agregando recomendación:', error);
            res.status(500).json({
                success: false,
                message: 'Error al agregar la recomendación: ' + error.message
            });
        }
    },

    // Generar reportes institucionales
    generateInstitutionalReport: async (req, res) => {
        try {
            const { startDate, endDate, groupBy } = req.query;
            
            let institutionId = req.user.institution;
            
            // Si es superadmin, puede especificar institución
            if (req.user.role === 'superadmin' && req.query.institutionId) {
                institutionId = req.query.institutionId;
            }

            // Verificar permisos
            if (req.user.role === 'expert' && req.user.institution.toString() !== institutionId) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver reportes de esta institución'
                });
            }

            const dateFilter = {};
            if (startDate && endDate) {
                dateFilter.createdAt = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            // Obtener todos los chats de usuarios de la institución
            const users = await User.find({ 
                institution: institutionId,
                role: 'user',
                isActive: true 
            });

            const userIds = users.map(user => user._id);

            const chats = await Chat.find({
                userId: { $in: userIds },
                isActive: true,
                ...dateFilter
            }).populate('userId');

            // Generar reporte agrupado
            let reportData = {};
            
            switch (groupBy) {
                case 'program':
                    reportData = await generateProgramReport(users, chats, institutionId);
                    break;
                case 'faculty':
                    reportData = await generateFacultyReport(users, chats, institutionId);
                    break;
                case 'career':
                    reportData = await generateCareerReport(users, chats, institutionId);
                    break;
                case 'semester':
                    reportData = await generateSemesterReport(users, chats);
                    break;
                default:
                    reportData = await generateGeneralReport(users, chats);
            }

            res.json({
                success: true,
                data: {
                    report: reportData,
                    period: {
                        startDate,
                        endDate,
                        groupBy
                    }
                }
            });

        } catch (error) {
            console.error('Error generando reporte:', error);
            res.status(500).json({
                success: false,
                message: 'Error al generar el reporte: ' + error.message
            });
        }
    },

    // Obtener todos los expertos de una institución
    getExperts: async (req, res) => {
    try {
        console.log('🔍 Solicitando lista de expertos...');
        console.log('👤 Usuario que solicita:', req.user._id, req.user.role);
        
        let institutionId = req.user.institution;
        
        // Si es superadmin, puede especificar institución
        if (req.user.role === 'superadmin' && req.query.institutionId) {
            institutionId = req.query.institutionId;
        }

        console.log('🏛️ Institución filtro:', institutionId);

        const query = { 
            role: 'expert',
            isActive: true 
        };

        // Solo filtrar por institución si se especifica
        if (institutionId) {
            query.institution = institutionId;
        }

        console.log('📋 Query de búsqueda:', query);

        const experts = await User.find(query)
            .select('-password')
            .populate('institution')
            .populate('expertProfile.assignedPrograms')
            .populate('expertProfile.assignedFaculties')
            .populate('expertProfile.assignedCareers');

        console.log(`✅ ${experts.length} expertos encontrados:`);
        experts.forEach(expert => {
            console.log(`   - ${expert.name} (${expert.email}) - Institución: ${expert.institution?.name || 'N/A'}`);
        });

        res.json({
            success: true,
            data: {
                experts
            }
        });

    } catch (error) {
        console.error('❌ Error obteniendo expertos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener los expertos: ' + error.message
        });
    }
},

getSuperAdminStats: async (req, res) => {
    try {
        console.log('📊 Solicitando estadísticas de super admin...');

        // Verificar que el usuario es superadmin
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para acceder a estas estadísticas'
            });
        }

        // 1. Obtener totales principales
        const totalUsers = await User.countDocuments({ isActive: true });
        const totalExperts = await User.countDocuments({ 
            role: 'expert', 
            isActive: true 
        });
        const totalInstitutions = await Institution.countDocuments({ isActive: true });

        console.log('📈 Totales obtenidos:', {
            users: totalUsers,
            experts: totalExperts,
            institutions: totalInstitutions
        });

        // 2. Gráfica 1: Cantidad de expertos por institución
        const expertsByInstitution = await User.aggregate([
            {
                $match: { 
                    role: 'expert', 
                    isActive: true,
                    institution: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$institution',
                    expertCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'institutions',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'institutionData'
                }
            },
            {
                $unwind: '$institutionData'
            },
            {
                $project: {
                    institutionName: '$institutionData.name',
                    expertCount: 1
                }
            },
            {
                $sort: { expertCount: -1 }
            }
        ]);

        // 3. Gráfica 2: Instituciones por tipo
        const institutionsByType = await Institution.aggregate([
            {
                $match: { isActive: true }
            },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    type: '$_id',
                    count: 1,
                    _id: 0
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        // 4. Datos adicionales para el dashboard
        const recentActivity = await User.find({ isActive: true })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('name email role createdAt')
            .lean();

        console.log('✅ Estadísticas generadas correctamente');

        // Estructura de respuesta CORREGIDA
        const responseData = {
            totals: {
                users: totalUsers,
                experts: totalExperts,
                institutions: totalInstitutions
            },
            charts: {
                expertsByInstitution: expertsByInstitution || [],
                institutionsByType: institutionsByType || []
            },
            recentActivity: recentActivity || []
        };

        console.log('📤 Enviando respuesta:', responseData.totals);

        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas de super admin:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las estadísticas del sistema'
        });
    }
},

updateExpert: async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log('✏️ Actualizando experto:', id, updateData);

        // Verificar permisos
        if (req.user.role !== 'superadmin' && req.user.role !== 'institutional_admin') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para actualizar expertos'
            });
        }

        // Para admins institucionales, verificar que el experto pertenezca a su institución
        if (req.user.role === 'institutional_admin') {
            const expert = await User.findById(id);
            if (!expert || !expert.institution || expert.institution.toString() !== req.user.institution.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para actualizar este experto'
                });
            }
        }

        // Preparar datos para actualización
        const updateFields = {
            name: updateData.name,
            email: updateData.email,
            institution: updateData.institutionId,
            isActive: updateData.isActive
        };

        // Si hay datos del perfil de experto, agregarlos
        if (updateData.expertProfile) {
            updateFields.expertProfile = {
                specialization: updateData.expertProfile.specialization,
                licenseNumber: updateData.expertProfile.licenseNumber || '',
                yearsOfExperience: updateData.expertProfile.yearsOfExperience || 0,
                maxPatients: updateData.expertProfile.maxPatients || 50,
                bio: updateData.expertProfile.bio || ''
            };
        }

        // Actualizar usuario experto
        const expert = await User.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true, runValidators: true }
        )
        .populate('institution')
        .select('-password');

        if (!expert) {
            return res.status(404).json({
                success: false,
                message: 'Experto no encontrado'
            });
        }

        console.log('✅ Experto actualizado:', expert.name);

        res.json({
            success: true,
            message: 'Experto actualizado exitosamente',
            data: { expert }
        });

    } catch (error) {
        console.error('❌ Error actualizando experto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar el experto: ' + error.message
        });
    }
},

// Eliminar experto (soft delete)
deleteExpert: async (req, res) => {
    try {
        const { id } = req.params;

        console.log('🗑️ Eliminando experto:', id);

        // Verificar permisos
        if (req.user.role !== 'superadmin' && req.user.role !== 'institutional_admin') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para eliminar expertos'
            });
        }

        // Para admins institucionales, verificar que el experto pertenezca a su institución
        if (req.user.role === 'institutional_admin') {
            const expert = await User.findById(id);
            if (!expert || !expert.institution || expert.institution.toString() !== req.user.institution.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para eliminar este experto'
                });
            }
        }

        // Verificar si el experto existe
        const expert = await User.findById(id);
        if (!expert) {
            return res.status(404).json({
                success: false,
                message: 'Experto no encontrado'
            });
        }

        // Verificar si hay pacientes asignados
        const patientsCount = await User.countDocuments({ 
            'patientProfile.assignedExpert': id, 
            isActive: true 
        });
        
        if (patientsCount > 0) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar el experto porque tiene ${patientsCount} paciente(s) asignado(s)`
            });
        }

        // Soft delete - marcar como inactivo
        expert.isActive = false;
        await expert.save();

        console.log('✅ Experto marcado como inactivo:', expert.name);

        res.json({
            success: true,
            message: 'Experto eliminado exitosamente'
        });

    } catch (error) {
        console.error('❌ Error eliminando experto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar el experto: ' + error.message
        });
    }
}

};

// Función auxiliar para verificar acceso de experto
async function checkExpertAccess(expert, targetUser) {
    // Si el experto no tiene asignaciones específicas, tiene acceso a todos los usuarios de la institución
    if (expert.expertProfile.assignedPrograms.length === 0 &&
        expert.expertProfile.assignedFaculties.length === 0 &&
        expert.expertProfile.assignedCareers.length === 0) {
        return true;
    }

    // Verificar por programa
    if (targetUser.institutionalPath.program && 
        expert.expertProfile.assignedPrograms.includes(targetUser.institutionalPath.program._id)) {
        return true;
    }

    // Verificar por facultad
    if (targetUser.institutionalPath.faculty && 
        expert.expertProfile.assignedFaculties.includes(targetUser.institutionalPath.faculty._id)) {
        return true;
    }

    // Verificar por carrera
    if (targetUser.institutionalPath.career && 
        expert.expertProfile.assignedCareers.includes(targetUser.institutionalPath.career._id)) {
        return true;
    }

    return false;
}

// Funciones auxiliares para generar reportes (las mismas que antes)
async function generateProgramReport(users, chats, institutionId) {
    const programs = await Program.find({ institution: institutionId });
    const report = {};
    
    programs.forEach(program => {
        const programUsers = users.filter(user => 
            user.institutionalPath.program?.toString() === program._id.toString()
        );
        const programUserIds = programUsers.map(user => user._id);
        const programChats = chats.filter(chat => 
            programUserIds.includes(chat.userId._id.toString())
        );
        
        report[program.name] = calculateGroupStats(programChats, programUsers.length);
    });
    
    return report;
}

async function generateFacultyReport(users, chats, institutionId) {
    const faculties = await Faculty.find({ institution: institutionId });
    const report = {};
    
    faculties.forEach(faculty => {
        const facultyUsers = users.filter(user => 
            user.institutionalPath.faculty?.toString() === faculty._id.toString()
        );
        const facultyUserIds = facultyUsers.map(user => user._id);
        const facultyChats = chats.filter(chat => 
            facultyUserIds.includes(chat.userId._id.toString())
        );
        
        report[faculty.name] = calculateGroupStats(facultyChats, facultyUsers.length);
    });
    
    return report;
}

async function generateCareerReport(users, chats, institutionId) {
    const careers = await Career.find({ institution: institutionId });
    const report = {};
    
    careers.forEach(career => {
        const careerUsers = users.filter(user => 
            user.institutionalPath.career?.toString() === career._id.toString()
        );
        const careerUserIds = careerUsers.map(user => user._id);
        const careerChats = chats.filter(chat => 
            careerUserIds.includes(chat.userId._id.toString())
        );
        
        report[career.name] = calculateGroupStats(careerChats, careerUsers.length);
    });
    
    return report;
}

async function generateSemesterReport(users, chats) {
    const semesters = [...new Set(users.map(user => user.institutionalPath.semester).filter(Boolean))];
    const report = {};
    
    semesters.forEach(semester => {
        const semesterUsers = users.filter(user => 
            user.institutionalPath.semester === semester
        );
        const semesterUserIds = semesterUsers.map(user => user._id);
        const semesterChats = chats.filter(chat => 
            semesterUserIds.includes(chat.userId._id.toString())
        );
        
        report[semester] = calculateGroupStats(semesterChats, semesterUsers.length);
    });
    
    return report;
}

async function generateGeneralReport(users, chats) {
    return calculateGroupStats(chats, users.length);
}

function calculateGroupStats(chats, totalUsers) {
    const totalChats = chats.length;
    const highRiskChats = chats.filter(chat => 
        chat.riskLevel === 'ALTO' || chat.riskLevel === 'high'
    ).length;
    const moderateRiskChats = chats.filter(chat => 
        chat.riskLevel === 'MODERADO' || chat.riskLevel === 'moderate'
    ).length;
    
    const averageRiskScore = chats.length > 0 ? 
        chats.reduce((sum, chat) => sum + (chat.riskScore || 0), 0) / chats.length : 0;
    
    return {
        totalUsers,
        totalChats,
        highRiskChats,
        moderateRiskChats,
        averageRiskScore: Math.round(averageRiskScore * 10) / 10,
        highRiskPercentage: totalUsers > 0 ? (highRiskChats / totalUsers) * 100 : 0
    };
}

function getOverallRiskLevel(averageScore) {
    if (averageScore >= 7) return 'ALTO';
    if (averageScore >= 5) return 'MODERADO';
    if (averageScore >= 3) return 'LEVE';
    return 'MINIMO';
}



module.exports = adminController;