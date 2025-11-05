const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

const protect = async (req, res, next) => {
    try {
        let token;

        console.log('🔐 Headers de autorización:', req.headers.authorization);
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
            console.log('✅ Token encontrado en headers');
        } else {
            console.log('❌ No se encontró token en headers');
        }

        if (!token) {
            console.log('❌ No hay token proporcionado');
            return res.status(401).json({
                success: false,
                message: 'No estás autorizado para acceder a esta ruta'
            });
        }

        try {
            // Verificar token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
            console.log('✅ Token verificado, user ID:', decoded.id);
            
            // Verificar sesión en la base de datos
            const session = await Session.findOne({ 
                token: token, 
                expiresAt: { $gt: new Date() } 
            }).populate('userId');

            if (!session) {
                console.log('❌ Sesión no encontrada o expirada');
                return res.status(401).json({
                    success: false,
                    message: 'Sesión expirada o inválida'
                });
            }

            console.log('✅ Sesión válida encontrada');
            
            // ✅ CORRECCIÓN CRÍTICA: Obtener el usuario COMPLETO de la base de datos
            const user = await User.findById(session.userId._id);
            if (!user) {
                console.log('❌ Usuario no encontrado en la base de datos');
                return res.status(401).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            // ✅ CORRECCIÓN: Establecer req.user con TODOS los datos del usuario
            req.user = {
                _id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                institution: user.institution,
                patientProfile: user.patientProfile,
                isAnonymous: false // ✅ IMPORTANTE
            };

            console.log('👤 Usuario autenticado establecido:', {
                id: req.user._id,
                email: req.user.email,
                role: req.user.role,
                isAnonymous: req.user.isAnonymous
            });

            next();
        } catch (error) {
            console.log('❌ Error verificando token:', error.message);
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }
    } catch (error) {
        console.log('❌ Error en middleware auth:', error);
        res.status(500).json({
            success: false,
            message: 'Error en la autenticación'
        });
    }
};

// 🔥 AGREGAR ESTA FUNCIÓN QUE FALTA
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado - Usuario no autenticado'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Usuario con rol ${req.user.role} no tiene permisos para acceder a esta ruta. Roles permitidos: ${roles.join(', ')}`
            });
        }

        next();
    };
};

// Middleware para usuarios anónimos
const anonymousAuth = async (req, res, next) => {
    try {
        let token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            // Crear usuario anónimo con estructura consistente
            req.user = { 
                _id: 'anonymous', 
                isAnonymous: true,
                role: 'anonymous'
            };
            console.log('👤 Usuario anónimo establecido');
            return next();
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
            const session = await Session.findOne({ 
                token: token, 
                expiresAt: { $gt: new Date() } 
            }).populate('userId');

            if (session) {
                // ✅ Obtener usuario COMPLETO para usuarios autenticados
                const user = await User.findById(session.userId._id);
                if (user) {
                    req.user = {
                        _id: user._id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        institution: user.institution,
                        patientProfile: user.patientProfile,
                        isAnonymous: false
                    };
                    console.log('👤 Usuario autenticado desde anonymousAuth:', req.user.email);
                } else {
                    req.user = { _id: 'anonymous', isAnonymous: true, role: 'anonymous' };
                }
            } else {
                req.user = { _id: 'anonymous', isAnonymous: true, role: 'anonymous' };
            }
        } catch (error) {
            req.user = { _id: 'anonymous', isAnonymous: true, role: 'anonymous' };
        }
        
        next();
    } catch (error) {
        req.user = { _id: 'anonymous', isAnonymous: true, role: 'anonymous' };
        next();
    }
};

// Middleware para límite de mensajes anónimos
const checkAnonymousLimit = async (req, res, next) => {
    if (req.user.isAnonymous) {
        const anonymousId = req.headers['x-anonymous-id'] || 'default';
        
        try {
            const Chat = require('../models/Chat');
            const messageCount = await Chat.countDocuments({
                'userId': 'anonymous',
                'anonymousId': anonymousId,
                'createdAt': { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24h
            });

            // Límite de 5 mensajes para usuarios anónimos
            if (messageCount >= 5) {
                return res.status(403).json({
                    success: false,
                    message: 'Límite de mensajes alcanzado. Por favor regístrate para continuar.',
                    requiresAuth: true,
                    limitReached: true
                });
            }
        } catch (error) {
            console.log('Error verificando límite anónimo:', error);
            // Continuar en caso de error
        }
    }
    next();
};

// 🔥 CORREGIR: Esta función ya existe como authorize, podemos eliminar esta duplicada o mantenerla como alias
exports.requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para esta acción'
            });
        }

        next();
    };
};

// 🔥 EXPORTAR TODAS LAS FUNCIONES CORRECTAMENTE
module.exports = { 
    protect, 
    authorize, // ✅ AGREGAR ESTA LÍNEA
    anonymousAuth, 
    checkAnonymousLimit,
    requireRole: exports.requireRole 
};