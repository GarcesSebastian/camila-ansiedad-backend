const axios = require('axios');
const constants = require('../config/constants');

class DeepSeekService {
    constructor() {
        this.apiKey = process.env.DEEPSEEK_API_KEY;
        this.apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    }

    async analyzeAnxiety(userMessage, conversationHistory = []) {
        // Primero: Análisis avanzado de ansiedad
        const anxietyAnalysis = this.advancedAnxietyAnalysis(userMessage);
        
        // Segundo: Generar respuesta contextualizada
        const systemPrompt = this.buildAnxietyAwarePrompt(anxietyAnalysis);

        try {
            const messages = [
                { role: 'system', content: systemPrompt },
                ...conversationHistory.slice(-6),
                { role: 'user', content: userMessage }
            ];

            const response = await axios.post(this.apiUrl, {
                model: 'deepseek-chat',
                messages: messages,
                temperature: 0.7,
                max_tokens: 1200,
                stream: false
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                timeout: 30000
            });

            if (!response.data.choices || !response.data.choices[0]) {
                throw new Error('Respuesta inválida de la API');
            }

            return {
                message: response.data.choices[0].message.content,
                riskLevel: anxietyAnalysis.riskLevel,
                riskScore: anxietyAnalysis.riskScore,
                indicators: anxietyAnalysis.indicators,
                tokensUsed: response.data.usage?.total_tokens || 0
            };

        } catch (error) {
            console.error('Error en DeepSeek Service:', error.response?.data || error.message);
            
            if (error.response?.status === 401) {
                throw new Error('API key inválida o expirada');
            } else if (error.response?.status === 429) {
                throw new Error('Límite de tasa excedido. Por favor intenta más tarde.');
            } else if (error.code === 'ECONNABORTED') {
                throw new Error('Tiempo de espera agotado. Por favor intenta de nuevo.');
            } else {
                throw new Error('Error al conectar con el servicio de IA. Por favor intenta más tarde.');
            }
        }
    }

    // ANÁLISIS AVANZADO DE ANSIEDAD - MEJORADO
    advancedAnxietyAnalysis(message) {
    const text = message.toLowerCase();
    const indicators = this.detectAnxietyIndicators(text);
    const colombianIndicators = this.detectColombianExpressions(text);
    const riskAssessment = this.calculateRiskLevel(indicators, colombianIndicators);
    
    return {
        riskLevel: riskAssessment.level,
        riskScore: riskAssessment.score,
        indicators: indicators,
        colombianContext: colombianIndicators,
        requiresImmediateAction: riskAssessment.level === 'ALTO',
        timestamp: new Date().toISOString()
    };
}

detectColombianExpressions(text) {
    const expressions = {
        // Expresiones de ansiedad comunes en Colombia
        'nerioso': text.includes('nerioso') || text.includes('neriosa'),
        'preocupao': text.includes('preocupao') || text.includes('preocupá'),
        'mamera': text.includes('mamera') || text.includes('qué pereza'),
        'estresado': text.includes('estresado') || text.includes('estresá'),
        'no puedo más': text.includes('no puedo más') || text.includes('no aguanto más'),
        
        // Expresiones de desesperanza locales
        'qué va ser': text.includes('qué va ser') || text.includes('qué será'),
        'esto no tiene solución': text.includes('no tiene solución') || text.includes('sin salida'),
        'estoy hasta la madre': text.includes('hasta la madre') || text.includes('harto'),
        
        // Expresiones físicas
        'me duele la cabeza': text.includes('me duele la cabeza') || text.includes('dolor de cabeza'),
        'marranero': text.includes('marranero') || text.includes('maread'),
        'patas de pollo': text.includes('patas de pollo') || text.includes('temblor')
    };

    const detected = Object.entries(expressions)
        .filter(([_, value]) => value)
        .map(([key, _]) => key);

    return {
        detected: detected,
        count: detected.length,
        hasLocalExpressions: detected.length > 0
    };
}

    // DETECCIÓN ESPECÍFICA DE INDICADORES DE ANSIEDAD
    detectAnxietyIndicators(text) {
        return {
            // Indicadores de crisis (máxima prioridad)
            suicidalIdeation: this.detectSuicidalIdeation(text),
            selfHarm: this.detectSelfHarm(text),
            
            // Síntomas de pánico y ansiedad aguda
            panicSymptoms: this.detectPanicSymptoms(text),
            acuteAnxiety: this.detectAcuteAnxiety(text),
            
            // Síntomas físicos de ansiedad
            physicalSymptoms: this.detectPhysicalSymptoms(text),
            
            // Síntomas cognitivos
            cognitiveSymptoms: this.detectCognitiveSymptoms(text),
            
            // Síntomas emocionales
            emotionalSymptoms: this.detectEmotionalSymptoms(text),
            
            // Factores de severidad
            severityIndicators: this.detectSeverityIndicators(text),
            
            // Palabras de desesperanza
            hopelessness: this.detectHopelessness(text)
        };
    }

    // DETECCIÓN DE INDICADORES ESPECÍFICOS
    detectSuicidalIdeation(text) {
        const patterns = [
            /\b(suicid|matar|acabar)\s+(conmigo|mi vida|todo)\b/,
            /\b(me voy a suicid|voy a matar|quiero morir)\b/,
            /\b(no quiero vivir|no merece la pena vivir|prefiero estar muerto)\b/,
            /\b(acabar con esta vida|terminar con todo)\b/,
            /\b(mejor muerto|sería mejor si muriera)\b/
        ];
        return patterns.some(pattern => pattern.test(text));
    }

    detectSelfHarm(text) {
        const patterns = [
            /\b(cortarme|hacerme daño|lastimarme|autolesion)\b/,
            /\b(herirme|dañarme el cuerpo)\b/
        ];
        return patterns.some(pattern => pattern.test(text));
    }

    detectPanicSymptoms(text) {
        const patterns = [
            /\b(ataque de pánico|pánico|desbordad[oa]|sobrepasad[oa])\b/,
            /\b(no puedo respirar|falta de aire|ahog[oa]|sofoc[oa])\b/,
            /\b(hiperventil|mareo intenso|vértigo)\b/,
            /\b(perder el control|volverme loc[oa]|enloquecer)\b/
        ];
        return patterns.some(pattern => pattern.test(text));
    }

    detectAcuteAnxiety(text) {
        const patterns = [
            /\b(crisis|emergencia|urgencia|desesperación)\b/,
            /\b(no aguanto más|no puedo más|límite|colapso)\b/,
            /\b(emergencia emocional|crisis emocional)\b/
        ];
        return patterns.some(pattern => pattern.test(text));
    }

    detectPhysicalSymptoms(text) {
        const patterns = [
            /\b(palpitac|corazón acelerad|taquicardi|presión en el pecho)\b/,
            /\b(temblor|sudor|manos húmedas|escalofrío)\b/,
            /\b(náusea|mareo|molestia estomacal|tensión muscular)\b/,
            /\b(dolor de cabeza|bruxismo|mandíbula apretada)\b/
        ];
        return patterns.some(pattern => pattern.test(text));
    }

    detectCognitiveSymptoms(text) {
        const patterns = [
            /\b(preocupación excesiv|pensamiento repetitiv|rumiación)\b/,
            /\b(no puedo parar de pensar|mente en blanco|confusión)\b/,
            /\b(dificultad para concentrar|olvidos frecuentes)\b/,
            /\b(miedo a perder el control|catastrofismo)\b/
        ];
        return patterns.some(pattern => pattern.test(text));
    }

    detectEmotionalSymptoms(text) {
        const patterns = [
            /\b(ansied|angusti|nervios|agitación)\b/,
            /\b(agobiad|abrumad|sobrecargad|estresad)\b/,
            /\b(miedo|temor|aprensiv|intranquilo)\b/,
            /\b(irritab|impaciente|molest[oa])\b/
        ];
        return patterns.some(pattern => pattern.test(text));
    }

    detectSeverityIndicators(text) {
        const patterns = [
            /\b(siempre|nunca|nada|todo|nadie)\b/, // Pensamientos absolutos
            /\b(extremadament|terriblement|horriblement|insoportable)\b/,
            /\b(no soporto|no resisto|no doy más)\b/
        ];
        return patterns.some(pattern => pattern.test(text));
    }

    detectHopelessness(text) {
        const patterns = [
            /\b(sin esperanza|sin solución|sin salida)\b/,
            /\b(no hay remedio|no tiene arreglo|todo está mal)\b/,
            /\b(fracasado|inútil|no sirvo para nada)\b/
        ];
        return patterns.some(pattern => pattern.test(text));
    }

    // CÁLCULO DE NIVEL DE RIESGO MEJORADO
    calculateRiskLevel(indicators, colombianIndicators) {
    let score = 0;

    // Ponderación basada en severidad (existente)
    if (indicators.suicidalIdeation) score += 40;
    if (indicators.selfHarm) score += 35;
    if (indicators.panicSymptoms) score += 25;
    if (indicators.acuteAnxiety) score += 20;
    if (indicators.hopelessness) score += 15;
    if (indicators.physicalSymptoms) score += 12;
    if (indicators.cognitiveSymptoms) score += 10;
    if (indicators.emotionalSymptoms) score += 8;
    if (indicators.severityIndicators) score += 5;

    // 🔥 NUEVO: Bonus por expresiones colombianas (indica autenticidad)
    if (colombianIndicators.hasLocalExpressions) {
        score += Math.min(colombianIndicators.count * 3, 10);
    }

    // Determinar nivel de riesgo
    if (score >= 30) {
        return { level: 'ALTO', score, color: '🟡' };
    } else if (score >= 15) {
        return { level: 'MODERADO', score, color: '🟠' };
    } else if (score >= 5) {
        return { level: 'LEVE', score, color: '🟢' };
    } else {
        return { level: 'MINIMO', score, color: '⚪' };
    }
}

    // CONSTRUIR PROMPT CONSCIENTE DE LA ANSIEDAD
    buildAnxietyAwarePrompt(anxietyAnalysis) {
    const riskLevel = anxietyAnalysis.riskLevel;
    const indicators = anxietyAnalysis.indicators;

    const basePrompt = `Eres Camila, una psicóloga virtual especializada en primeros auxilios psicológicos y manejo de ansiedad.

CONTEXTO COLOMBIANO:
- País: Colombia 🇨🇴
- Recursos locales: EPS, líneas de atención 106, centros de salud mental
- Sistema de salud: Régimen contributivo y subsidiado
- Plataforma de citas: ${constants.APPOINTMENT_URL}

ANÁLISIS ACTUAL DE ANSIEDAD:
- Nivel de riesgo: ${riskLevel} (${anxietyAnalysis.riskScore}%)
- Indicadores detectados: ${this.formatIndicators(indicators)}

${this.getColombianContext(riskLevel)}

DIRECTIVAS ESPECÍFICAS SEGÚN EL NIVEL DE RIESGO:

${this.getRiskLevelDirectives(riskLevel)}

RECURSOS PARA COLOMBIA (integrar cuando sea apropiado):
• 📞 Línea 106 - Atención en crisis 24/7 (gratuita)
• 🏥 EPS - Tu entidad de salud tiene servicio de psicología
• 💜 Línea Púrpura - 018000112137 (violencia contra mujeres)
• 🎓 Universidades - Servicios de bienestar universitario
• 🏛️ Hospitales públicos - Urgencias psiquiátricas
• 💙 Citas profesionales - ${constants.APPOINTMENT_URL}

TÉCNICAS PARA MANEJO DE ANSIEDAD:
• "Respiración Consciente": Inspirar profundamente, exhalar lentamente
• "Mindfulness": Observar el entorno con atención plena
• "Técnica de Grounding": Enfocarse en el momento presente
• "Pausa Activa": Tomar un momento consciente para respirar

${this.getAppointmentGuidelines(riskLevel)}

FORMATO DE RESPUESTA:
- Empieza con validación emocional (1-2 frases)
- Identifica síntomas principales con empatía
- Ofrece técnicas prácticas adaptadas al contexto
- Integra recursos locales cuando sea necesario
- Mantén tono cálido, empático y profesional
- Máximo 2-3 emojis relevantes
- EVITA jergas colombianas como "parce", "mi ciela", "quiubo", etc.
- Usa lenguaje profesional y universal

ENFOQUE CULTURAL:
- Reconoce el contexto socioeconómico colombiano
- Valida las preocupaciones comunes (estudio, trabajo, familia)
- Sé consciente de las diferencias regionales`;

    return basePrompt;
}

// 🔥 AGREGAR este nuevo método para contexto colombiano:
getColombianContext(riskLevel) {
    const contexts = {
        'ALTO': `🚨 CRISIS DETECTADA - RECURSOS INMEDIATOS EN COLOMBIA
• Deriva inmediatamente a línea 106 o urgencias
• Enfatiza que la ayuda está disponible en el sistema de salud colombiano
• Proporciona contención emocional con calidez profesional`,

        'MODERADO': `⚠️ ANSIEDAD MODERADA - APOYO EN RED LOCAL
• Sugiere contactar EPS para programa de psicología
• Recomienda servicios de bienestar en universidades o trabajo
• Valida el estrés en contexto local`,

        'LEVE': `📋 ANSIEDAD LEVE - TÉCNICAS PRÁCTICAS
• Enseña técnicas de relajación efectivas
• Normaliza la ansiedad en el ritmo de vida actual
• Sugiere actividades reconfortantes`,

        'MINIMO': `💬 CONVERSACIÓN - APOYO EMOCIONAL
• Escucha activa con calidez profesional
• Ofrece compañía y validación
• Comparte recursos educativos sobre salud mental`
    };

    return contexts[riskLevel] || contexts['MINIMO'];
}

getAppointmentGuidelines(riskLevel) {
    const guidelines = {
        'ALTO': `🚨 DIRECTIVAS PARA ALTO RIESGO:
• SIEMPRE incluir recomendación de cita profesional al final de la respuesta
• Enfatizar la importancia del seguimiento profesional
• Proporcionar el enlace: ${constants.APPOINTMENT_URL}
• Validar que buscar ayuda es un acto de fortaleza`,

        'MODERADO': `⚠️ DIRECTIVAS PARA ANSIEDAD MODERADA:
• CONSIDERAR recomendar cita si el usuario muestra interés en apoyo continuo
• Mencionar la plataforma de citas como opción de seguimiento
• Enfatizar beneficios del acompañamiento profesional
• Proporcionar el enlace: ${constants.APPOINTMENT_URL}`,

        'LEVE': `📋 DIRECTIVAS PARA ANSIEDAD LEVE:
• Puedes mencionar la plataforma de citas como recurso educativo
• Enfatizar el valor preventivo de la atención profesional
• Presentarlo como opción para desarrollo personal`,

        'MINIMO': `💬 DIRECTIVAS PARA RIESGO MÍNIMO:
• No es necesario mencionar citas a menos que el usuario pregunte
• Enfatizar recursos educativos y de autoayuda`
    };

    return guidelines[riskLevel] || guidelines['MINIMO'];
}

    formatIndicators(indicators) {
        const activeIndicators = [];
        for (const [key, value] of Object.entries(indicators)) {
            if (value) {
                activeIndicators.push(key);
            }
        }
        return activeIndicators.length > 0 ? activeIndicators.join(', ') : 'Sin indicadores significativos';
    }

    getRiskLevelDirectives(riskLevel) {
        const directives = {
            'ALTO': `🚨 PRIORIDAD MÁXIMA - CRISIS DETECTADA
• Expresa preocupación genuina y validación inmediata
• Proporciona recursos de crisis CLARAMENTE
• Anima a contactar ayuda profesional INMEDIATAMENTE
• Mantén la calma y proporciona contención emocional
• NO minimices los sentimientos
• Ofrece acompañamiento en el proceso
• Solicitar una cita`,

            'MODERADO': `⚠️ ANSIEDAD MODERADA - ATENCIÓN NECESARIA
• Valida la experiencia emocional intensa
• Ofrece técnicas de grounding inmediatas
• Sugiere recursos de apoyo profesional
• Enfatiza que la ansiedad es tratable
• Proporciona esperanza realista`,

            'LEVE': `📋 ANSIEDAD LEVE - APOYO PREVENTIVO
• Educa sobre manejo de ansiedad
• Comparte técnicas prácticas de relajación
• Normaliza la experiencia
• Sugiere seguimiento si persisten los síntomas
• Refuerza la capacidad de recuperación`,

            'MINIMO': `💬 CONVERSACIÓN GENERAL - APOYO EMOCIONAL
• Ofrece escucha activa
• Pregunta si hay preocupaciones específicas
• Proporciona información educativa sobre ansiedad
• Mantén un tono de apoyo y validación`
        };

        return directives[riskLevel] || directives['MINIMO'];
    }

    // Método de compatibilidad (para mantener funcionamiento existente)
    detectRiskLevel(content) {
        const analysis = this.advancedAnxietyAnalysis(content);
        // Mapear a los niveles antiguos para compatibilidad
        const levelMap = {
            'ALTO': 'high',
            'MODERADO': 'moderate', 
            'LEVE': 'low',
            'MINIMO': null
        };
        return levelMap[analysis.riskLevel] || null;
    }

    async analyzeText(prompt) {
    try {
        const response = await axios.post(this.apiUrl, {
            model: 'deepseek-chat',
            messages: [
                { role: 'user', content: prompt }
            ],
            temperature: 0.3, // Menor temperatura para análisis más consistentes
            max_tokens: 800,
            stream: false
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            timeout: 25000
        });

        if (!response.data.choices || !response.data.choices[0]) {
            throw new Error('Respuesta inválida de la API');
        }

        return response.data.choices[0].message.content;

    } catch (error) {
        console.error('Error en análisis de texto DeepSeek:', error);
        throw error;
    }
}
}

module.exports = new DeepSeekService();