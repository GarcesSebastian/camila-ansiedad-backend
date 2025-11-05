const Chat = require('../models/Chat');
const User = require('../models/User');
const deepseekService = require('../services/deepseekService');
const RiskAnalysisService = require('../services/riskAnalysisService');
const constants = require('../config/constants');

// Lista de saludos colombianos para detección
const colombianGreetings = [
    'hola', 'buenos días', 'buenas tardes', 'buenas noches', 'qué más', 
    'qué hubo', 'quiubo', 'buenas', 'saludos', 'hey', 'holi',
    'buen día', 'cómo está', 'cómo estás', 'qué tal', 'habla',
    'buenas', 'parce', 'hermano', 'amigo', 'vecino'
];

// Enviar mensaje a Camila - VERSIÓN MEJORADA CON DETECCIÓN DE SALUDOS
exports.sendMessage = async (req, res) => {
    try {
        console.log('💬 Recibiendo mensaje...');
        const { message, chatId, anonymousId } = req.body;
        const user = req.user;

        if (!message || message.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'El mensaje no puede estar vacío'
            });
        }

        // 🔥 NUEVO: Detectar si es un saludo
        const isGreeting = this.detectGreeting(message);
        console.log('🎯 Detección de saludo:', { isGreeting, message: message.substring(0, 50) });
        
        let chat;
        let isNewChat = false;

        // ✅ Manejo correcto de usuarios registrados vs anónimos
        if (chatId) {
            chat = await Chat.findById(chatId);
            if (!chat) {
                return res.status(404).json({
                    success: false,
                    message: 'Chat no encontrado'
                });
            }
        } else {
            const chatData = {
                title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                messages: [],
                isActive: true
            };

            console.log('🔍 Estado del usuario para crear chat:', {
                tieneUser: !!user,
                userId: user?._id,
                userEmail: user?.email,
                isAnonymous: user?.isAnonymous,
                role: user?.role
            });

            // ✅ CORRECCIÓN CRÍTICA: Manejo correcto de usuarios anónimos
            if (user && user._id && !user.isAnonymous) {
                // USUARIO REGISTRADO
                chatData.user = user._id;
                chatData.institution = user.institution;
                chatData.isAnonymous = false;
                console.log('👤 Creando chat para USUARIO REGISTRADO:', user._id);
            } else {
                // USUARIO ANÓNIMO - SOLO usar anonymousId, NO asignar user
                chatData.anonymousId = anonymousId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                chatData.isAnonymous = true;
                // ✅ CRÍTICO: NO asignar chatData.user para anónimos
                console.log('👤 Creando chat para USUARIO ANÓNIMO:', chatData.anonymousId);
            }

            chat = await Chat.create(chatData);
            isNewChat = true;
            console.log('✅ Nuevo chat creado:', {
                id: chat._id,
                user: chat.user, 
                anonymousId: chat.anonymousId,
                isAnonymous: chat.isAnonymous,
                title: chat.title
            });
        }

        // Agregar mensaje del usuario
        chat.messages.push({
            role: 'user',
            content: message.trim(),
            timestamp: new Date(),
            isGreeting: isGreeting // 🔥 NUEVO: Marcar si es saludo
        });

        await chat.save();
        console.log('✅ Mensaje del usuario guardado');

        // 🔥 NUEVO: Si es saludo y chat nuevo, responder con bienvenida especial
        if (isGreeting && isNewChat) {
            const welcomeResponse = this.generateColombianWelcome();
            
            chat.messages.push({
                role: 'assistant',
                content: welcomeResponse,
                timestamp: new Date(),
                isWelcome: true
            });

            chat.riskLevel = 'minimo';
            chat.riskScore = 0;
            chat.updatedAt = new Date();
            await chat.save();

            console.log('🎉 Respuesta de bienvenida colombiana enviada');

            return res.json({
                success: true,
                data: {
                    chat: {
                        _id: chat._id,
                        title: chat.title,
                        messages: chat.messages,
                        user: chat.user,
                        anonymousId: chat.anonymousId,
                        isAnonymous: chat.isAnonymous,
                        riskLevel: chat.riskLevel,
                        riskScore: chat.riskScore,
                        updatedAt: chat.updatedAt,
                        createdAt: chat.createdAt
                    },
                    response: welcomeResponse,
                    isGreeting: true
                }
            });
        }

        // ✅ Ejecutar análisis de palabras clave para usuarios registrados
        let riskAnalysis = null;
        let finalRiskLevel = 'minimo';
        let finalRiskScore = 0;

        // Solo para usuarios registrados (no anónimos)
        if (user && user._id && !user.isAnonymous && user.institution) {
            console.log('🔍 Ejecutando análisis de palabras clave...');
            try {
                riskAnalysis = await RiskAnalysisService.analyzeConversationWithKeywords(
                    message, 
                    user.institution
                );
                
                if (riskAnalysis) {
                    finalRiskLevel = riskAnalysis.riskLevel.toLowerCase();
                    finalRiskScore = riskAnalysis.riskScore;
                    console.log('📊 Análisis palabras clave:', {
                        riskLevel: finalRiskLevel,
                        riskScore: finalRiskScore,
                        keywords: riskAnalysis.detectedKeywords.length
                    });

                    // Actualizar perfil del paciente
                    try {
                        console.log('👤 Actualizando perfil del paciente...', {
                            userId: user._id,
                            riskLevel: finalRiskLevel,
                            riskScore: finalRiskScore
                        });
                        
                        await User.findByIdAndUpdate(user._id, {
                            'patientProfile.lastRiskAssessment': {
                                riskLevel: finalRiskLevel,
                                riskScore: finalRiskScore,
                                assessedAt: new Date(),
                                chatId: chat._id,
                                keywordsDetected: riskAnalysis.detectedKeywords?.length || 0
                            },
                            'patientProfile.riskLevel': finalRiskLevel,
                            'patientProfile.lastEvaluation': new Date()
                        }, { new: true, runValidators: true });
                        
                        console.log('✅ Perfil de paciente actualizado con riesgo:', finalRiskLevel);
                        
                    } catch (updateError) {
                        console.error('❌ Error actualizando perfil del paciente:', updateError);
                    }
                }
            } catch (error) {
                console.error('Error en análisis palabras clave:', error);
            }
        }

        // Generar respuesta de Camila
         let responseMessage;
        try {
            console.log('🤖 Consultando a DeepSeek...');
            const deepseekResponse = await deepseekService.analyzeAnxiety(message);
            console.log('✅ Respuesta de DeepSeek recibida');
            
            responseMessage = deepseekResponse.message || "He recibido tu mensaje. Estoy aquí para apoyarte.";
            
            // 🔥 NUEVO: Agregar recomendación de cita si es necesario
            if (this.shouldRecommendAppointment(deepseekResponse, riskAnalysis)) {
                const appointmentMessage = this.getAppointmentMessage(deepseekResponse, riskAnalysis);
                responseMessage += appointmentMessage;
                
                console.log('💙 Recomendación de cita agregada');
            }
            
            if (riskAnalysis) {
                finalRiskLevel = riskAnalysis.riskLevel.toLowerCase();
                finalRiskScore = riskAnalysis.riskScore;
            } else {
                finalRiskLevel = this.mapRiskLevel(deepseekResponse.riskLevel || 'minimo');
                finalRiskScore = deepseekResponse.riskScore || 0;
            }
            
        } catch (error) {
            console.error('❌ Error generando respuesta con DeepSeek:', error);
            responseMessage = "He recibido tu mensaje. Estoy aquí para ayudarte. ¿Puedes contarme más sobre cómo te sientes?";
            finalRiskLevel = 'minimo';
            finalRiskScore = 0;
        }

        // Asegurar que riskLevel esté en minúsculas
        if (finalRiskLevel) {
            const riskMap = {
                'MINIMO': 'minimo',
                'ALTO': 'alto', 
                'MODERADO': 'medio',
                'LEVE': 'bajo',
                'CRITICO': 'critico'
            };
            chat.riskLevel = riskMap[finalRiskLevel] || finalRiskLevel.toLowerCase();
        } else {
            chat.riskLevel = 'minimo';
        }
        
        chat.riskScore = finalRiskScore;
        
        if (riskAnalysis) {
            chat.analysis = {
                keywordAnalysis: riskAnalysis
            };
        }

        // Agregar respuesta de Camila
        chat.messages.push({
            role: 'assistant',
            content: responseMessage,
            timestamp: new Date()
        });

        // Actualizar timestamp del chat
        chat.updatedAt = new Date();
        await chat.save();
        console.log('✅ Respuesta de Camila guardada con análisis de riesgo');

        res.json({
            success: true,
            data: {
                chat: {
                    _id: chat._id,
                    title: chat.title,
                    messages: chat.messages,
                    user: chat.user,
                    anonymousId: chat.anonymousId,
                    isAnonymous: chat.isAnonymous,
                    riskLevel: chat.riskLevel,
                    riskScore: chat.riskScore,
                    updatedAt: chat.updatedAt,
                    createdAt: chat.createdAt
                },
                response: responseMessage
            }
        });

    } catch (error) {
        console.error('Error en sendMessage:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor: ' + error.message
        });
    }
};

// 🔥 NUEVO: Detectar si el mensaje es un saludo
exports.detectGreeting = function(message) {
    const cleanMessage = message.toLowerCase().trim();
    
    // Verificar saludos directos
    const isDirectGreeting = colombianGreetings.some(greeting => 
        cleanMessage.startsWith(greeting) || 
        cleanMessage === greeting ||
        cleanMessage.includes(greeting + ' ')
    );
    
    // Verificar patrones de saludo común
    const greetingPatterns = [
        /^hola\s+.+/i,
        /^buen(os|as)\s+.+/i,
        /^qué\s+(más|hubo|tal)/i,
        /^cómo\s+(estás|está)/i,
        /^(hi|hello|hey)\s*.+/i
    ];
    
    const hasGreetingPattern = greetingPatterns.some(pattern => 
        pattern.test(cleanMessage)
    );
    
    // Si es muy corto y parece saludo
    const isShortGreeting = cleanMessage.split(/\s+/).length <= 3 && 
        (isDirectGreeting || hasGreetingPattern);
    
    return isDirectGreeting || hasGreetingPattern || isShortGreeting;
};

// 🔥 NUEVO: Generar bienvenida colombiana
exports.generateColombianWelcome = function() {
    const welcomes = [
        `¡Hola! 👋 ¡Qué bueno que estés aquí! 

Soy Camila, tu psicóloga virtual. Estoy aquí para escucharte y apoyarte en todo lo que necesites.

**💚 Este es tu espacio seguro donde puedes:**
• Contarme lo que sientes con toda confianza
• Hablar de tus preocupaciones libremente  
• Aprender técnicas para manejar la ansiedad
• Conocer recursos de apoyo en Colombia
• Simplemente desahogarte

**🌟 ¿En qué te puedo ayudar hoy?** Puedes contarme sobre:
• Tus preocupaciones o estrés
• Síntomas de ansiedad que estés sintiendo
• Situaciones que te tengan nervioso/a
• O cualquier cosa que quieras compartir

**📞 Recuerda:** Si es una emergencia, puedes contactar a la línea 106 de atención en crisis.

¿Quieres contarme cómo te sientes hoy? 🫂`,

        `¡Buenas! 🤗 ¡Me da mucho gusto que estés aquí!

Soy Camila, tu acompañante en salud mental. Este es un espacio sin juicios donde puedes expresarte libremente.

**💫 Estoy aquí para:**
• Escucharte con atención y empatía
• Ayudarte con técnicas para manejar la ansiedad
• Orientarte sobre recursos de salud mental en Colombia
• Acompañarte en momentos difíciles

**🎯 ¿Qué te trae por aquí hoy?** Puedes hablarme de:
• Esa preocupación que no te deja quieto/a
• Esos nervios que sientes en el cuerpo
• Esa situación que te tiene estresado/a
• O simplemente cómo ha estado tu día

**🏥 Recursos disponibles:** Línea 106 (24/7), tu EPS, servicios universitarios

Cuéntame, ¿cómo has estado? 💭`,

        `¡Hola! 😊 ¡Me alegra que me escribas!

Soy Camila, tu psicóloga virtual. Aquí puedes hablar con toda confianza, en un espacio seguro y comprensivo.

**💚 En este espacio encontrarás:**
• Comprensión genuina de tus sentimientos
• Herramientas prácticas para la ansiedad
• Información sobre recursos en Colombia
• Apoyo incondicional sin etiquetas

**🌟 ¿Qué te gustaría compartir?** Me encantaría saber sobre:
• Esas preocupaciones que te quitan la tranquilidad
• Esos pensamientos que dan vueltas en tu mente
• Esa situación que te tiene con el corazón acelerado
• O simplemente cómo te ha ido en la semana

**📞 No estás solo/a:** Tenemos la línea 106 para emergencias y tu EPS para apoyo continuo.

¿Qué tal? ¿Cómo te sientes en este momento? 🫂`,

        `¡Hola! 💫 ¡Me alegra mucho que me busques!

Soy Camila, tu compañera en este camino de bienestar emocional. Entiendo lo retador que puede ser el día a día.

**🌿 Te ofrezco:**
• Un oído atento sin prisas ni juicios
• Estrategias prácticas para manejar la ansiedad
• Información sobre recursos de salud mental en Colombia
• Acompañamiento con profesionalismo y empatía

**💫 ¿Qué te motiva a escribirme hoy?** Puede ser:
• Esa sensación de nervios que no se va
• Preocupaciones sobre el estudio, trabajo o familia
• Ganas de entender mejor lo que sientes
• Necesidad de hablar con alguien que entienda

**📱 Recuerda:** La línea 106 está disponible 24/7 para crisis, y tu EPS tiene programas de salud mental.

¿Por dónde quieres comenzar? 🌟`,

        `¡Buen día! 🌞 ¡Me alegra que estés aquí!

Soy Camila, tu psicóloga virtual de confianza. Sé que la vida puede presentar desafíos, pero juntos podemos navegar estas situaciones.

**💚 En este espacio seguro encontrarás:**
• Comprensión genuina de tus sentimientos
• Herramientas prácticas para la ansiedad
• Información sobre recursos en Colombia
• Apoyo constante sin juicios

**🎯 ¿Qué está pasando por tu mente?** Me encantaría saber sobre:
• Esa inquietud que no te deja en paz
• Esos pensamientos recurrentes
• Esa situación que te tiene preocupado/a
• O simplemente cómo te ha ido recientemente

**🏥 Tu salud mental importa:** Línea 106, consulta con psicología en tu EPS, grupos de apoyo.

¿Me cuentas qué te trae por aquí? 🤗`
    ];

    return welcomes[Math.floor(Math.random() * welcomes.length)];
};

exports.processPatientMessage = async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user._id;

        console.log('\n🚨🚨🚨 ===== INICIANDO PROCESAMIENTO DE MENSAJE ===== 🚨🚨🚨');
        console.log('👤 Usuario ID:', userId);
        console.log('💬 Mensaje:', message);

        // 🔥 NUEVO: Detectar si es saludo para pacientes también
        const isGreeting = this.detectGreeting(message);
        if (isGreeting) {
            console.log('🎯 Saludo detectado para paciente, generando bienvenida...');
            const welcomeResponse = this.generateColombianWelcome();
            
            return res.json({
                success: true,
                data: {
                    response: welcomeResponse,
                    riskLevel: 'minimo',
                    riskScore: 0,
                    isGreeting: true
                }
            });
        }

        // 1. Obtener paciente con institución
        const patient = await User.findById(userId).populate('institution');
        
        if (!patient) {
            console.error('❌ PACIENTE NO ENCONTRADO');
            throw new Error('Paciente no encontrado');
        }

        let keywordAnalysis = null;
        let finalRiskLevel = 'minimo';
        let finalRiskScore = 0;

        // 2. ANÁLISIS CON PALABRAS CLAVE (si tiene institución)
        if (patient.institution) {
            console.log('\n🎯 EJECUTANDO ANÁLISIS CON PALABRAS CLAVE...');
            
            try {
                keywordAnalysis = await RiskAnalysisService.analyzeConversationWithKeywords(
                    message, 
                    patient.institution._id
                );
                
                console.log('✅ Análisis con palabras clave COMPLETADO');
                finalRiskLevel = keywordAnalysis.riskLevel.toLowerCase();
                finalRiskScore = keywordAnalysis.riskScore;

            } catch (error) {
                console.error('❌ Error en análisis con palabras clave:', error.message);
            }
        }

        // 3. Análisis tradicional con DeepSeek
        console.log('\n🤖 EJECUTANDO ANÁLISIS DEEPSEEK...');
        let deepseekResponse;
        try {
            deepseekResponse = await deepseekService.analyzeAnxiety(message);
            console.log('✅ Análisis DeepSeek COMPLETADO');
            
            // 🔥 NUEVO: Agregar recomendación de cita si es necesario
            if (this.shouldRecommendAppointment(deepseekResponse, keywordAnalysis)) {
                const appointmentMessage = this.getAppointmentMessage(deepseekResponse, keywordAnalysis);
                deepseekResponse.message += appointmentMessage;
                
                console.log('💙 Recomendación de cita agregada para paciente');
            }
            
        } catch (error) {
            console.error('❌ Error en análisis DeepSeek:', error.message);
            deepseekResponse = {
                message: "Lo siento, estoy teniendo problemas técnicos. Por favor intenta de nuevo.",
                riskLevel: 'minimo',
                riskScore: 0,
                indicators: {}
            };
        }

        // 4. COMBINAR RESULTADOS
        console.log('\n🎯 COMBINANDO RESULTADOS...');
        if (!keywordAnalysis || this.isKeywordAnalysisMoreSevere(keywordAnalysis, deepseekResponse)) {
            finalRiskLevel = (keywordAnalysis ? keywordAnalysis.riskLevel : this.mapRiskLevel(deepseekResponse.riskLevel)).toLowerCase();
            finalRiskScore = keywordAnalysis ? keywordAnalysis.riskScore : deepseekResponse.riskScore;
        }

        console.log('🎯 RIESGO FINAL DETERMINADO:', {
            level: finalRiskLevel,
            score: finalRiskScore
        });

        // 5. Guardar el chat con ambos análisis
        console.log('\n💾 GUARDANDO CHAT EN BASE DE DATOS...');
        const chat = await Chat.create({
            user: userId, // ✅ CAMBIADO: de userId a user
            messages: [{
                role: 'user',
                content: message,
                timestamp: new Date()
            }, {
                role: 'assistant', 
                content: deepseekResponse.message,
                timestamp: new Date()
            }],
            riskLevel: finalRiskLevel,
            riskScore: finalRiskScore,
            analysis: {
                traditional: {
                    riskLevel: deepseekResponse.riskLevel,
                    riskScore: deepseekResponse.riskScore,
                    indicators: deepseekResponse.indicators
                },
                keywordAnalysis: keywordAnalysis ? {
                    riskLevel: keywordAnalysis.riskLevel,
                    riskScore: keywordAnalysis.riskScore,
                    detectedKeywords: keywordAnalysis.detectedKeywords,
                    summary: keywordAnalysis.summary
                } : null
            },
            institution: patient.institution?._id
        });

        console.log('✅ Chat guardado con ID:', chat._id);

        // 6. ACTUALIZAR PERFIL DEL PACIENTE
        console.log('\n📝 ACTUALIZANDO PERFIL DEL PACIENTE...');
        
        const updateData = {
            'patientProfile.lastRiskAssessment': {
                riskLevel: finalRiskLevel,
                riskScore: finalRiskScore,
                assessedAt: new Date(),
                chatId: chat._id,
                keywordsDetected: keywordAnalysis?.detectedKeywords?.length || 0
            },
            'patientProfile.riskLevel': finalRiskLevel,
            'patientProfile.lastEvaluation': new Date()
        };

        // Si patientProfile no existe, crear uno completo
        if (!patient.patientProfile) {
            updateData.patientProfile = {
                assignedExpert: patient.patientProfile?.assignedExpert || null,
                status: 'active',
                riskLevel: finalRiskLevel,
                lastEvaluation: new Date(),
                lastRiskAssessment: updateData['patientProfile.lastRiskAssessment']
            };
        }

        try {
            await User.updateOne(
                { _id: userId },
                { $set: updateData }
            );
            console.log('✅ ACTUALIZACIÓN EXITOSA');
        } catch (updateError) {
            console.error('❌ ERROR EN ACTUALIZACIÓN:', updateError.message);
        }

        console.log('\n✅ PROCESAMIENTO COMPLETADO EXITOSAMENTE');

        res.json({
            success: true,
            data: {
                response: deepseekResponse.message,
                riskLevel: finalRiskLevel,
                riskScore: finalRiskScore,
                keywordAnalysis: keywordAnalysis,
                chatId: chat._id
            }
        });

    } catch (error) {
        console.error('\n❌❌❌ ERROR CRÍTICO PROCESANDO MENSAJE ❌❌❌');
        console.error('Mensaje:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Error procesando el mensaje'
        });
    }
};

// Obtener chats del usuario - CORREGIDO CON 'user'
exports.getChats = async (req, res) => {
    try {
        const user = req.user;
        const { page = 1, limit = 20 } = req.query;

        console.log('🔍 Buscando chats para:', {
            userId: user?._id,
            userEmail: user?.email,
            isAnonymous: user?.isAnonymous
        });

        let query = { isActive: true };
        let chats;

        // ✅ CORREGIDO: Manejo correcto de usuarios anónimos vs registrados
        if (user && user._id && !user.isAnonymous) {
            // USUARIO REGISTRADO
            query.user = user._id;
            query.isAnonymous = false;
            console.log('👤 Buscando chats de USUARIO REGISTRADO:', user._id);
        } else {
            // USUARIO ANÓNIMO
            query.anonymousId = user.userId; // El middleware anonymousAuth establece user.userId
            query.isAnonymous = true;
            console.log('👤 Buscando chats de USUARIO ANÓNIMO:', user.userId);
        }

        console.log('🔎 Query final:', query);

        chats = await Chat.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('user', 'name email')
            .populate('institution', 'name');

        const total = await Chat.countDocuments(query);

        console.log('📊 Resultados:', {
            totalEnBD: total,
            chatsEncontrados: chats.length
        });

        res.json({
            success: true,
            data: {
                chats: chats.map(chat => ({
                    _id: chat._id,
                    title: chat.title,
                    messages: chat.messages,
                    user: chat.user,
                    anonymousId: chat.anonymousId,
                    isAnonymous: chat.isAnonymous,
                    riskLevel: chat.riskLevel,
                    riskScore: chat.riskScore,
                    updatedAt: chat.updatedAt,
                    createdAt: chat.createdAt,
                    lastMessage: chat.lastMessage,
                    lastMessageDate: chat.lastMessageDate
                })),
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });

    } catch (error) {
        console.error('Error en getChats:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Obtener chat específico - VERSIÓN COMPLETAMENTE CORREGIDA CON 'user'
exports.getChat = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        console.log('🔍 Buscando chat específico:', {
            chatId: id,
            userId: user?._id,
            userEmail: user?.email
        });

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID de chat no proporcionado'
            });
        }

        let query = { 
            _id: id, 
            isActive: true 
        };

        // ✅ CONSULTA MEJORADA para usuarios registrados
        if (user && user._id && !user.isAnonymous) {
            query.user = user._id; // ✅ CAMBIADO: de userId a user
            console.log('👤 Buscando chat de usuario registrado');
        } else {
            return res.status(401).json({
                success: false,
                message: 'No autorizado'
            });
        }

        console.log('🔎 Query para getChat:', JSON.stringify(query));

        const chat = await Chat.findOne(query)
            .populate('user', 'name email') // ✅ CAMBIADO: de userId a user
            .populate('institution', 'name');

        if (!chat) {
            console.log('❌ Chat no encontrado con query:', JSON.stringify(query));
            
            // Diagnóstico adicional: verificar si el chat existe sin el filtro de usuario
            const chatExists = await Chat.findById(id);
            if (chatExists) {
                console.log('⚠️ Chat existe pero no pertenece al usuario:', {
                    chatUser: chatExists.user, // ✅ CAMBIADO: de userId a user
                    currentUserId: user._id
                });
            } else {
                console.log('⚠️ Chat no existe en la base de datos');
            }
            
            return res.status(404).json({
                success: false,
                message: 'Chat no encontrado'
            });
        }

        console.log('✅ Chat encontrado:', {
            id: chat._id,
            title: chat.title,
            messagesCount: chat.messages?.length
        });

        res.json({
            success: true,
            data: { chat }
        });

    } catch (error) {
        console.error('❌ Error obteniendo chat:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor: ' + error.message
        });
    }
};

// Eliminar chat - CORREGIDO CON 'user'
exports.deleteChat = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        console.log('🗑️ Eliminando chat:', {
            chatId: id,
            userId: user._id,
            userEmail: user.email
        });

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID de chat no proporcionado'
            });
        }

        // Buscar el chat que pertenezca al usuario
        const chat = await Chat.findOne({
            _id: id,
            user: user._id, // ✅ CAMBIADO: de userId a user
            isActive: true
        });

        if (!chat) {
            console.log('❌ Chat no encontrado o no autorizado:', id);
            return res.status(404).json({
                success: false,
                message: 'Chat no encontrado'
            });
        }

        // Soft delete - marcar como inactivo
        chat.isActive = false;
        chat.updatedAt = new Date();
        await chat.save();

        console.log('✅ Chat eliminado (soft delete):', id);

        res.json({
            success: true,
            message: 'Chat eliminado exitosamente'
        });

    } catch (error) {
        console.error('❌ Error eliminando chat:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor: ' + error.message
        });
    }
};

// Obtener métricas de ansiedad del usuario - CORREGIDO CON 'user'
exports.getAnxietyMetrics = async (req, res) => {
    try {
        const userId = req.user._id;

        const metrics = await Chat.aggregate([
            {
                $match: {
                    user: userId, // ✅ CAMBIADO: de userId a user
                    isActive: true,
                    riskScore: { $ne: null }
                }
            },
            {
                $group: {
                    _id: null,
                    totalChats: { $sum: 1 },
                    highRiskChats: {
                        $sum: { $cond: [{ $eq: ['$riskLevel', 'alto'] }, 1, 0] }
                    },
                    avgRiskScore: { $avg: '$riskScore' },
                    maxRiskScore: { $max: '$riskScore' },
                    lastAssessment: { $max: '$lastRiskAssessment' }
                }
            }
        ]);

        const result = metrics[0] || {
            totalChats: 0,
            highRiskChats: 0,
            avgRiskScore: 0,
            maxRiskScore: 0,
            lastAssessment: null
        };

        res.json({
            success: true,
            data: { metrics: result }
        });

    } catch (error) {
        console.error('Error obteniendo métricas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Método auxiliar para comparar severidad
exports.isKeywordAnalysisMoreSevere = (keywordAnalysis, deepseekResponse) => {
    const severity = {
        'critico': 4,
        'alto': 3, 
        'medio': 2,
        'bajo': 1,
        'minimo': 0
    };
    
    const keywordSeverity = severity[keywordAnalysis.riskLevel] || 0;
    const deepseekSeverity = severity[this.mapRiskLevel(deepseekResponse.riskLevel)] || 0;
    
    return keywordSeverity > deepseekSeverity;
};

// Mapear niveles de riesgo de DeepSeek
exports.mapRiskLevel = (deepseekLevel) => {
    if (!deepseekLevel) return 'minimo';
    
    const map = {
        'ALTO': 'alto',
        'MODERADO': 'medio', 
        'LEVE': 'bajo',
        'MINIMO': 'minimo'
    };
    return map[deepseekLevel] || 'minimo';
};

// Función auxiliar para calcular métricas de ansiedad
function calculateAnxietyMetrics(chats) {
    if (chats.length === 0) {
        return {
            averageRiskScore: 0,
            highRiskChats: 0,
            moderateRiskChats: 0,
            lowRiskChats: 0,
            minimalRiskChats: 0,
            riskTrend: 'stable',
            commonIndicators: []
        };
    }

    const riskScores = chats.map(chat => chat.riskScore || 0).filter(score => score > 0);
    const averageRiskScore = riskScores.length > 0 ? 
        riskScores.reduce((a, b) => a + b, 0) / riskScores.length : 0;

    const riskCounts = {
        alto: chats.filter(chat => chat.riskLevel === 'alto').length,
        medio: chats.filter(chat => chat.riskLevel === 'medio').length,
        bajo: chats.filter(chat => chat.riskLevel === 'bajo').length,
        minimo: chats.filter(chat => chat.riskLevel === 'minimo' || !chat.riskLevel).length
    };

    return {
        averageRiskScore: Math.round(averageRiskScore * 10) / 10,
        highRiskChats: riskCounts.alto,
        moderateRiskChats: riskCounts.medio,
        lowRiskChats: riskCounts.bajo,
        minimalRiskChats: riskCounts.minimo,
        riskTrend: 'stable',
        commonIndicators: []
    };
}

// Métodos de diagnóstico y reparación - CORREGIDOS CON 'user'
exports.forceRepairDatabase = async (req, res) => {
    try {
        const userId = req.user._id;
        const mongoose = require('mongoose');
        const Chat = require('../models/Chat');
        
        console.log('🚨 EJECUTANDO REPARACIÓN CRÍTICA PARA USUARIO:', userId);
        
        const allChats = await Chat.find({});
        console.log('📊 Total de chats en BD:', allChats.length);
        
        const userChats = allChats.filter(chat => {
            if (!chat.user) return false;
            return chat.user.toString() === userId.toString() || 
                   (chat.user._id && chat.user._id.toString() === userId.toString()) ||
                   chat.user === userId.toString();
        });
        
        console.log('👤 Chats del usuario (filtrado manual):', userChats.length);
        
        let repairedCount = 0;
        for (const chat of userChats) {
            try {
                chat.user = new mongoose.Types.ObjectId(userId);
                chat.isAnonymous = false;
                chat.updatedAt = new Date();
                await chat.save();
                repairedCount++;
                console.log(`✅ Chat reparado: ${chat._id}`);
            } catch (saveError) {
                console.log(`⚠️ Error guardando chat ${chat._id}:`, saveError.message);
            }
        }
        
        console.log('🎯 REPARACIÓN COMPLETADA:', repairedCount, 'chats reparados');
        
        res.json({
            success: true,
            message: `Reparación crítica completada. ${repairedCount} chats reparados de ${userChats.length} encontrados.`,
            repaired: repairedCount,
            found: userChats.length
        });
        
    } catch (error) {
        console.error('❌ Error en reparación crítica:', error);
        res.status(500).json({
            success: false,
            message: 'Error en reparación crítica: ' + error.message
        });
    }
};

exports.diagnoseChats = async (req, res) => {
    try {
        const userId = req.user._id;
        
        console.log('🔍 DIAGNÓSTICO DE CHATS PARA USUARIO:', userId);
        
        const allChats = await Chat.find({ 
            $or: [
                { user: userId }, // ✅ CAMBIADO: de userId a user
                { user: userId.toString() }, // ✅ CAMBIADO: de userId a user
                { 'user._id': userId }
            ]
        });
        
        console.log('📊 Chats encontrados en BD:', allChats.length);
        
        res.json({
            success: true,
            data: {
                totalChats: allChats.length,
                chats: allChats.map(chat => ({
                    _id: chat._id,
                    user: chat.user, // ✅ CAMBIADO: de userId a user
                    isAnonymous: chat.isAnonymous,
                    title: chat.title,
                    messagesCount: chat.messages.length,
                    updatedAt: chat.updatedAt
                }))
            }
        });
        
    } catch (error) {
        console.error('Error en diagnóstico:', error);
        res.status(500).json({
            success: false,
            message: 'Error en diagnóstico'
        });
    }
};

// Función auxiliar para migrar chats existentes
exports.migrateExistingChats = async (req, res) => {
    try {
        console.log('🔄 Iniciando migración de chats existentes...');
        
        const result = await Chat.updateMany(
            { 
                $or: [
                    { riskScore: { $exists: false } },
                    { anxietyIndicators: { $exists: false } },
                    { lastRiskAssessment: { $exists: false } }
                ]
            },
            { 
                $set: { 
                    riskScore: null,
                    anxietyIndicators: {},
                    lastRiskAssessment: null
                } 
            }
        );
        
        console.log(`✅ Migración completada: ${result.modifiedCount} chats actualizados`);
        
        res.json({
            success: true,
            message: `Migración completada: ${result.modifiedCount} chats actualizados`
        });
        
    } catch (error) {
        console.error('❌ Error en migración:', error);
        res.status(500).json({
            success: false,
            message: 'Error en la migración: ' + error.message
        });
    }
};

exports.shouldRecommendAppointment = function(deepseekResponse, riskAnalysis) {
    console.log('🔍 Evaluando recomendación de cita:', {
        deepseekLevel: deepseekResponse?.riskLevel,
        deepseekScore: deepseekResponse?.riskScore,
        riskAnalysisLevel: riskAnalysis?.riskLevel,
        riskAnalysisScore: riskAnalysis?.riskScore
    });
    
    // Si tenemos análisis de palabras clave
    if (riskAnalysis) {
        const highRiskLevels = ['alto', 'critico'];
        const highRiskScore = riskAnalysis.riskScore >= 40;
        
        if (highRiskLevels.includes(riskAnalysis.riskLevel) || highRiskScore) {
            console.log('✅ Recomendación ACTIVADA por análisis de palabras clave');
            return true;
        }
    }
    
    // Si tenemos respuesta de DeepSeek
    if (deepseekResponse) {
        const highRiskLevels = ['ALTO', 'MODERADO'];
        const highRiskScore = deepseekResponse.riskScore >= 40;
        
        // 🔥 CORRECCIÓN: También verificar por análisis de indicadores
        const hasCriticalIndicators = deepseekResponse.indicators?.suicidalIdeation || 
                                    deepseekResponse.indicators?.selfHarm;
        
        if (highRiskLevels.includes(deepseekResponse.riskLevel) || 
            highRiskScore || 
            hasCriticalIndicators) {
            console.log('✅ Recomendación ACTIVADA por DeepSeek');
            return true;
        }
    }
    
    console.log('❌ Recomendación NO activada');
    return false;
};

// 🔥 NUEVO: Obtener mensaje de cita apropiado
exports.getAppointmentMessage = function(deepseekResponse, riskAnalysis) {
    const riskLevel = riskAnalysis ? riskAnalysis.riskLevel : deepseekResponse.riskLevel;
    const isHighRisk = ['alto', 'critico', 'ALTO'].includes(riskLevel);
    
    if (isHighRisk) {
        return `\n\n---\n💙 **¿Necesitas más apoyo?**\nPuedes agendar una cita con psicólogos especializados\n[📅 Solicitar cita ahora](https://sigepsi.garcessebastian.com/)`;
    } else {
        return `\n\n---\n💙 **Seguimiento profesional**  \nPara un apoyo más continuo\n[📅 Agendar cita](https://sigepsi.garcessebastian.com/)`;
    }
};

