const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
require('dotenv').config();

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const institutionRoutes = require('./routes/institutionRoutes');
const expertRoutes = require('./routes/expertRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// 🔥 CONFIGURACIÓN CORS MEJORADA
const corsOptions = {
    origin: function (origin, callback) {
        // En desarrollo, permitir todos los orígenes locales
        if (process.env.NODE_ENV === 'development') {
            const allowedOrigins = [
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'http://localhost:3001', 
                'http://127.0.0.1:3001',
                'http://localhost:5000',
                'http://127.0.0.1:5000',
                'http://localhost:8080',
                'http://127.0.0.1:8080'
            ];
            
            // Permitir requests sin origin (como Postman, móviles, etc.)
            if (!origin) return callback(null, true);
            
            if (allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                console.log('🔒 Origen bloqueado por CORS:', origin);
                callback(new Error('No permitido por CORS'));
            }
        } else {
            // En producción, usar el FRONTEND_URL
            callback(null, process.env.FRONTEND_URL || 'http://localhost:3000');
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With', 
        'X-Anonymous-Id',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    exposedHeaders: [
        'Content-Range', 
        'X-Content-Range',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Credentials'
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400 // 24 horas
};

// 🔥 MIDDLEWARES EN ORDEN CORRECTO

// 1. CORS PRIMERO - Esencial para las peticiones del frontend
app.use(cors(corsOptions));

// 2. Helmet para seguridad con configuración específica
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
}));

// 3. Body parsing para JSON y URL encoded
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 100000
}));

// 4. Rate limiting DESPUÉS de CORS y body parsing
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000, // Aumentar límite para desarrollo
    message: {
        success: false,
        message: 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.ip; // Usar IP del cliente
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde.'
        });
    }
});

app.use(limiter);

// 🔥 MANEJAR PREFLIGHT REQUESTS EXPLÍCITAMENTE
app.options('*', cors(corsOptions));

// Middleware de logging para debug
// app.use((req, res, next) => {
//     console.log(`🌐 ${new Date().toISOString()} | ${req.method} ${req.path} | Origin: ${req.headers.origin || 'No Origin'} | IP: ${req.ip}`);
//     next();
// });

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('✅ Conectado a MongoDB Atlas');
    
    // Verificar conexión
    const db = mongoose.connection;
    db.on('error', (error) => {
        console.error('❌ Error de MongoDB:', error);
    });
    
    db.on('disconnected', () => {
        console.log('⚠️  MongoDB desconectado');
    });
    
    db.on('reconnected', () => {
        console.log('🔁 MongoDB reconectado');
    });
})
.catch((error) => {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
});

// ✅ RUTAS - EN EL ORDEN CORRECTO

// ✅ NUEVA RUTA: Términos y condiciones - AGREGADA ANTES DE LAS OTRAS RUTAS
app.get('/api/auth/terms', cors(corsOptions), (req, res) => {
    console.log('📋 Términos y condiciones solicitados');
    res.json({
        success: true,
        data: {
            title: 'Términos y Condiciones - Camila',
            lastUpdated: 'Octubre 2025',
            content: `
                <h1>Términos y Condiciones</h1>
                <p><strong>Última actualización:</strong> Octubre 2025</p>
                
                <h2>1. Aceptación de los Términos</h2>
                <p>Al acceder y utilizar el asistente Camila, usted acepta estar sujeto a estos términos y condiciones de uso. Si no está de acuerdo con alguna parte de estos términos, no debe utilizar este servicio.</p>
                
                <h2>2. Descripción del Servicio</h2>
                <p>Camila es un asistente virtual basado en Inteligencia Artificial Generativa diseñado para proporcionar información y orientación sobre estrategias de afrontamiento para trastornos mentales. El servicio es ofrecido por Instituciones de Educación Superior como apoyo a su comunidad académica.</p>
                
                <h2>3. Uso del Servicio</h2>
                <p>El usuario se compromete a:</p>
                <ul>
                    <li>Utilizar el servicio de manera responsable y ética</li>
                    <li>Proporcionar información veraz al interactuar con el asistente</li>
                    <li>No utilizar el servicio para fines ilegales o no autorizados</li>
                    <li>No intentar comprometer la seguridad o integridad del sistema</li>
                    <li>Respetar los derechos de propiedad intelectual del contenido</li>
                </ul>
                
                <h2>4. Limitaciones del Servicio</h2>
                <p>Camila proporciona información general y orientación sobre estrategias de afrontamiento en salud mental como acciones que se toman para manejar situaciones difíciles y obstáculos diarios. Este servicio <strong>NO constituye el acompañamiento de un profesional o terapeuta</strong>. Para casos específicos, se recomienda solicitar una cita de asesoría psicológica en la institución donde se encuentre afiliado.</p>
                
                <h2>5. Privacidad y Datos Personales</h2>
                <p>La información que usted proporciona a Camila será tratada de acuerdo con las leyes de protección de datos personales de Colombia. Los datos recopilados incluyen:</p>
                <ul>
                    <li>Edad, Género, Afiliación</li>
                    <li>Contenido de las conversaciones con el asistente virtual</li>
                    <li>Valoraciones (me gusta/no me gusta) de las respuestas</li>
                </ul>
                <p>Estos datos se utilizan exclusivamente para mejorar el servicio y proporcionar estadísticas agregadas. No se compartirán con terceros sin su consentimiento expreso.</p>
                
                <h2>6. Valoración de Respuestas</h2>
                <p>El sistema de valoración (me gusta/no me gusta) nos ayuda a mejorar la calidad de las respuestas. Al proporcionar su valoración, usted acepta que esta información sea utilizada para fines de mejora del servicio.</p>
                
                <h2>7. Disponibilidad del Servicio</h2>
                <p>Nos esforzamos por mantener el servicio disponible de manera continua, pero no garantizamos que estará libre de interrupciones o errores. Nos reservamos el derecho de modificar, suspender o discontinuar el servicio en cualquier momento sin previo aviso.</p>
                
                <h2>8. Modificaciones a los Términos</h2>
                <p>Nos reservamos el derecho de modificar estos términos y condiciones en cualquier momento. Los cambios entrarán en vigor inmediatamente después de su publicación en esta página. Es responsabilidad del usuario revisar periódicamente estos términos.</p>
                
                <h2>9. Contacto</h2>
                <p>Para preguntas o inquietudes sobre estos términos y condiciones, puede contactar a <a href="mailto:mbonfanter@gmail.com">mbonfanter@gmail.com</a>.</p>
                
                <h2>10. Ley Aplicable</h2>
                <p>Estos términos y condiciones se rigen por las leyes de la República de Colombia. Cualquier disputa relacionada con estos términos será resuelta en los tribunales competentes de Colombia.</p>
            `
        }
    });
});

// Rutas públicas (sin autenticación)
app.use('/api/auth', authRoutes);

// Rutas protegidas (con autenticación)
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/institution', institutionRoutes);
app.use('/api/expert', expertRoutes);
app.use('/api/users', userRoutes);

// 🔥 RUTAS DE SISTEMA Y HEALTH CHECKS

// Ruta de salud - pública
app.get('/api/health', cors(corsOptions), (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    res.json({
        success: true,
        message: 'Camila API está funcionando correctamente',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: dbStatus,
        uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
        memory: {
            used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
            total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
        },
        cors: 'configurado',
        version: '1.0.0'
    });
});

// Ruta de información del sistema
app.get('/api/info', cors(corsOptions), (req, res) => {
    res.json({
        name: 'Camila - Sistema de Detección de Ansiedad',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        description: 'Sistema integral para detección y seguimiento de ansiedad',
        features: [
            'Chat con IA para detección de ansiedad',
            'Panel de expertos para seguimiento',
            'Sistema de recomendaciones personalizadas',
            'Gestión institucional multi-tenant',
            'Formularios dinámicos por tipo de institución'
        ],
        endpoints: {
            auth: '/api/auth',
            chat: '/api/chat',
            admin: '/api/admin',
            institution: '/api/institution',
            expert: '/api/expert',
            user: '/api/users'
        }
    });
});

// Ruta de estado de servicios
app.get('/api/status', cors(corsOptions), async (req, res) => {
    try {
        const status = {
            api: 'operational',
            database: mongoose.connection.readyState === 1 ? 'operational' : 'degraded',
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString(),
            services: {
                authentication: 'operational',
                chat: 'operational',
                recommendations: 'operational',
                institutional_management: 'operational'
            }
        };

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estado del sistema'
        });
    }
});

/*
function logRoutes() {
    console.log('\n🛣️  ========== RUTAS CARGADAS ==========');
    
    const routes = [];
    app._router.stack.forEach((middleware) => {
        if (middleware.name === 'router') {
            const basePath = middleware.regexp.toString()
                .replace('/^', '')
                .replace('\\/?(?=\\/|$)/i', '')
                .replace(/\\/g, '')
                .replace('(?:', '')
                .replace(')?', '');
            
            console.log(`\n📍 Router Base: ${basePath}`);
            
            if (middleware.handle && middleware.handle.stack) {
                middleware.handle.stack.forEach((handler) => {
                    if (handler.route) {
                        const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
                        const path = handler.route.path;
                        console.log(`   ${methods.padEnd(6)} ${path}`);
                        routes.push({
                            method: methods,
                            path: basePath + path
                        });
                    }
                });
            }
        } else if (middleware.route) {
            const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
            const path = middleware.route.path;
            console.log(`   ${methods.padEnd(6)} ${path}`);
            routes.push({
                method: methods,
                path: path
            });
        }
    });
    
    console.log('====================================\n');
    console.log('🔍 Rutas específicas que deberían funcionar:');
    console.log('   GET    /api/institution/institutions');
    console.log('   GET    /api/admin/experts');
    console.log('   POST   /api/admin/experts');
    console.log('   GET    /api/health');
    console.log('   GET    /api/auth/terms'); // ✅ NUEVA RUTA AGREGADA
    console.log('\n');
    
    return routes;
}
    */

// Ejecutar el log de rutas después de que el servidor esté listo
// setTimeout(() => {
//     logRoutes();
// }, 100);

// 🔥 MANEJO DE RUTAS NO ENCONTRADAS
app.use('*', cors(corsOptions), (req, res) => {
    console.log(`❌ Ruta no encontrada: ${req.method} ${req.originalUrl}`);
    
    res.status(404).json({
        success: false,
        message: `Ruta no encontrada: ${req.originalUrl}`,
        availableEndpoints: {
            auth: ['/api/auth/login', '/api/auth/register', '/api/auth/profile', '/api/auth/terms'], // ✅ AGREGADO
            chat: ['/api/chat/message', '/api/chat/chats', '/api/chat/metrics'],
            admin: ['/api/admin/experts', '/api/admin/users', '/api/admin/recommendations'],
            institution: ['/api/institution/institutions', '/api/institution/structure'],
            expert: ['/api/expert/patients', '/api/expert/recommendations', '/api/expert/dashboard'],
            user: ['/api/users/recommendations'],
            system: ['/api/health', '/api/info', '/api/status']
        },
        help: 'Asegúrate de usar el prefijo /api en todas las rutas'
    });
});

// 🔥 MANEJO GLOBAL DE ERRORES
app.use((error, req, res, next) => {
    console.error('❌ Error global:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });
    
    // Manejar errores CORS específicamente
    if (error.message === 'No permitido por CORS') {
        return res.status(403).json({
            success: false,
            message: `Origen no permitido: ${req.headers.origin}`,
            allowedOrigins: [
                'http://localhost:3000', 
                'http://127.0.0.1:3000',
                'http://localhost:3001',
                'http://127.0.0.1:3001'
            ],
            yourOrigin: req.headers.origin
        });
    }
    
    // Error de MongoDB duplicado
    if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        const value = error.keyValue[field];
        return res.status(400).json({
            success: false,
            message: `El ${field} '${value}' ya está registrado en el sistema.`
        });
    }
    
    // Error de validación de Mongoose
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(e => ({
            field: e.path,
            message: e.message
        }));
        
        return res.status(400).json({
            success: false,
            message: 'Error de validación en los datos enviados',
            errors: errors
        });
    }
    
    // Error de JWT
    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Token de autenticación inválido'
        });
    }
    
    // Token expirado
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token de autenticación expirado'
        });
    }
    
    // Error de cast de MongoDB (ID inválido)
    if (error.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: `ID inválido: ${error.value}`
        });
    }
    
    // Error de muy pesado
    if (error.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: 'Los datos enviados son demasiado grandes. Límite: 10MB'
        });
    }
    
    // Error genérico del servidor
    const statusCode = error.status || error.statusCode || 500;
    
    res.status(statusCode).json({
        success: false,
        message: error.message || 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { 
            stack: error.stack,
            details: error 
        }),
        timestamp: new Date().toISOString()
    });
});

// 🔥 MANEJO DE PROCESOS NO CAPTURADOS
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Rejection no manejado:', reason);
    console.error('En la promesa:', promise);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Excepción no capturada:', error);
    process.exit(1);
});

// 🔥 GRACEFUL SHUTDOWN
const gracefulShutdown = async () => {
    try {
        console.log('👋 Cerrando conexiones...');
        
        // Cerrar conexión de MongoDB (sin callback)
        await mongoose.connection.close();
        console.log('✅ Conexión a MongoDB cerrada');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error cerrando conexiones:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => {
    console.log('🔻 Recibido SIGTERM, cerrando servidor gracefully...');
    gracefulShutdown();
});

process.on('SIGINT', () => {
    console.log('🔻 Recibido SIGINT, cerrando servidor gracefully...');
    gracefulShutdown();
});

// Exportar la app
module.exports = app;