const mongoose = require('mongoose');
const Keyword = require('../models/Keyword');
const deepseekService = require('./deepseekService');
const constants = require('../config/constants');

// Registrar modelos necesarios para populate
const registerModelsForService = () => {
    if (!mongoose.models.User) {
        const userSchema = new mongoose.Schema({
            name: String,
            email: String,
            role: String,
            institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution' }
        }, { strict: false, timestamps: true });
        
        mongoose.model('User', userSchema);
    }
    
    if (!mongoose.models.Institution) {
        const institutionSchema = new mongoose.Schema({
            name: String,
            type: String
        }, { strict: false, timestamps: true });
        
        mongoose.model('Institution', institutionSchema);
    }
};

class RiskAnalysisService {
    /**
     * Analiza una conversación usando palabras clave y DeepSeek
     */
    async analyzeConversationWithKeywords(conversationText, institutionId) {
        try {
            console.log('🔍 Iniciando análisis de riesgo...');
            console.log('📝 Texto a analizar:', conversationText.substring(0, 100) + '...');
            
            // Registrar modelos antes de usarlos
            registerModelsForService();
            
            // 1. Obtener palabras clave de la institución - SIN POPULATE
            const keywords = await Keyword.find({ 
                institution: institutionId,
                isActive: true 
            }).lean(); // Usar lean() para evitar problemas de populate
            
            console.log('🔤 Palabras clave disponibles:', keywords.length);
            keywords.forEach(kw => {
                console.log(`   - "${kw.keyword}" (${kw.symptom}, peso: ${kw.weight})`);
            });
            
            // 2. Análisis local con palabras clave
            const localAnalysis = this.localKeywordAnalysis(conversationText, keywords);
            console.log('📊 Análisis local - Keywords detectadas:', localAnalysis.detectedKeywords.length);
            localAnalysis.detectedKeywords.forEach(kw => {
                console.log(`   ✅ "${kw.keyword}" (${kw.symptom}, peso: ${kw.weight})`);
            });
            
            // 3. Análisis con DeepSeek (si hay palabras clave detectadas)
            let deepseekAnalysis = null;
            if (localAnalysis.detectedKeywords.length > 0) {
                console.log('🤖 Ejecutando análisis DeepSeek...');
                deepseekAnalysis = await this.deepseekContextualAnalysis(conversationText, localAnalysis, keywords);
            } else {
                console.log('⚠️  No hay keywords detectadas, omitiendo DeepSeek');
            }
            
            // 4. Calcular nivel de riesgo final
            const riskLevel = this.calculateFinalRiskLevel(localAnalysis, deepseekAnalysis);
            console.log('🎯 Nivel de riesgo final:', riskLevel.level, 'Score:', riskLevel.score);
            
            return {
                riskLevel: riskLevel.level,
                riskScore: riskLevel.score,
                detectedKeywords: localAnalysis.detectedKeywords,
                contextualAnalysis: deepseekAnalysis,
                summary: this.generateAnalysisSummary(localAnalysis, deepseekAnalysis, riskLevel),
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error en análisis de riesgo:', error);
            // Fallback a análisis básico
            return this.basicRiskAnalysis(conversationText);
        }
    }

    /**
     * Análisis local basado en palabras clave - CORREGIDO
     */
    localKeywordAnalysis(text, keywords) {
        console.log('🔍 Ejecutando análisis local de keywords...');
        const lowerText = text.toLowerCase();
        const detectedKeywords = [];
        let totalWeight = 0;
        
        keywords.forEach(keyword => {
            // Buscar la palabra clave en el texto - MÉTODO MEJORADO
            const keywordFound = this.containsKeywordImproved(lowerText, keyword.keyword);
            
            if (keywordFound) {
                const context = this.extractContext(text, keyword.keyword);
                console.log(`   ✅ KEYWORD DETECTADA: "${keyword.keyword}" en contexto: "${context}"`);
                
                detectedKeywords.push({
                    keyword: keyword.keyword,
                    symptom: keyword.symptom,
                    weight: keyword.weight,
                    context: context,
                    exactMatch: true
                });
                totalWeight += keyword.weight;
            }
        });
        
        // Calcular score basado en pesos
        const maxPossibleWeight = keywords.reduce((sum, kw) => sum + kw.weight, 0);
        const weightPercentage = maxPossibleWeight > 0 ? (totalWeight / maxPossibleWeight) * 100 : 0;
        
        console.log(`📊 Resultado análisis local: ${detectedKeywords.length} keywords, Peso total: ${totalWeight}, Porcentaje: ${weightPercentage}%`);
        
        return {
            detectedKeywords: detectedKeywords,
            totalWeight: totalWeight,
            weightPercentage: weightPercentage,
            keywordCount: detectedKeywords.length
        };
    }

    /**
     * Búsqueda mejorada de palabras clave - CORREGIDA
     */
    containsKeywordImproved(text, keyword) {
        const normalizedKeyword = keyword.toLowerCase().trim();
        const normalizedText = text.toLowerCase();
        
        // 1. Búsqueda exacta simple
        if (normalizedText.includes(normalizedKeyword)) {
            return true;
        }
        
        // 2. Búsqueda por palabras compuestas
        const keywordWords = normalizedKeyword.split(/\s+/);
        if (keywordWords.length > 1) {
            // Verificar que todas las palabras estén presentes
            return keywordWords.every(word => normalizedText.includes(word));
        }
        
        // 3. Búsqueda por variaciones (eliminar plurales, etc.)
        const baseWord = normalizedKeyword.replace(/s$/, ''); // Remover 's' final
        if (baseWord !== normalizedKeyword && normalizedText.includes(baseWord)) {
            return true;
        }
        
        return false;
    }

    /**
     * Análisis contextual con DeepSeek
     */
    async deepseekContextualAnalysis(text, localAnalysis, keywords) {
        try {
            const prompt = this.createContextualPrompt(text, localAnalysis, keywords);
            console.log('🤖 Enviando a DeepSeek...');
            const response = await deepseekService.analyzeText(prompt);
            
            return this.parseDeepSeekResponse(response);
        } catch (error) {
            console.error('❌ Error en análisis contextual DeepSeek:', error);
            return null;
        }
    }

    /**
     * Crear prompt contextualizado para DeepSeek
     */
    createContextualPrompt(text, localAnalysis, keywords) {
    const detectedList = localAnalysis.detectedKeywords.map(kw => 
        `- "${kw.keyword}" (${kw.symptom}, peso: ${kw.weight}) - Contexto: "${kw.context}"`
    ).join('\n');
    
    return `
    Eres un psicólogo especializado en detección temprana de problemas de salud mental.
    
    TEXTO DEL USUARIO:
    "${text}"
    
    PALABRAS CLAVE DETECTADAS (con sus pesos):
    ${detectedList}
    
    LISTA COMPLETA DE PALABRAS CLAVE CONFIGURADAS:
    ${keywords.map(kw => `- ${kw.keyword} (${kw.symptom}, peso: ${kw.weight})`).join('\n')}
    
    PLATAFORMA DE CITAS DISPONIBLE: ${constants.APPOINTMENT_URL}
    
    Por favor analiza:
    1. El contexto emocional del mensaje
    2. La severidad basada en las palabras clave detectadas y sus pesos
    3. El nivel de riesgo (bajo, medio, alto, crítico)
    4. Si recomendar cita profesional (para riesgo alto o moderado)
    5. Recomendaciones específicas
    
    Responde en formato JSON:
    {
        "riskAssessment": {
            "level": "bajo|medio|alto|critico",
            "score": 0-100,
            "confidence": 0.0-1.0,
            "needsAppointment": true|false
        },
        "emotionalContext": "descripción del contexto emocional",
        "keyConcerns": ["lista de preocupaciones principales"],
        "recommendations": ["lista de recomendaciones"],
        "urgency": "baja|media|alta|inmediata"
    }
    `;
}

    /**
     * Calcular nivel de riesgo final - MEJORADO
     */
    calculateFinalRiskLevel(localAnalysis, deepseekAnalysis) {
        console.log('📈 Calculando riesgo final...');
        
        // Puntuación base del análisis local
        let localScore = this.calculateLocalRiskScore(localAnalysis);
        console.log('📊 Score local:', localScore);
        
        // Si tenemos análisis de DeepSeek, combinamos
        if (deepseekAnalysis && deepseekAnalysis.riskAssessment) {
            const deepseekScore = deepseekAnalysis.riskAssessment.score;
            console.log('📊 Score DeepSeek:', deepseekScore);
            
            const finalScore = (localScore * 0.7) + (deepseekScore * 0.3);
            console.log('📊 Score final combinado:', finalScore);
            
            return {
                score: Math.min(100, Math.round(finalScore)),
                level: this.scoreToRiskLevel(finalScore)
            };
        }
        
        // Solo análisis local
        console.log('📊 Usando solo score local');
        return {
            score: Math.min(100, Math.round(localScore)),
            level: this.scoreToRiskLevel(localScore)
        };
    }

    /**
     * Calcular score de riesgo basado en análisis local - MEJORADO
     */
    calculateLocalRiskScore(localAnalysis) {
    const { detectedKeywords, totalWeight, weightPercentage } = localAnalysis;
    
    if (detectedKeywords.length === 0) {
        console.log('📊 Score local: 0 (no keywords detectadas)');
        return 0;
    }
    
    // ✅ CORREGIDO: Enfoque basado en PESO MÁXIMO principalmente
    const maxWeight = Math.max(...detectedKeywords.map(kw => kw.weight || 0));
    const highWeightCount = detectedKeywords.filter(kw => kw.weight >= 4).length;
    const mediumWeightCount = detectedKeywords.filter(kw => kw.weight === 3).length;
    
    console.log(`📊 Cálculo score local CORREGIDO:`);
    console.log(`   - Peso máximo: ${maxWeight}`);
    console.log(`   - Keywords alto peso (4-5): ${highWeightCount}`);
    console.log(`   - Keywords medio peso (3): ${mediumWeightCount}`);
    console.log(`   - Total keywords: ${detectedKeywords.length}`);
    
    let totalScore = 0;
    
    // ✅ CORREGIDO: PUNTUACIÓN BASADA EN PESO MÁXIMO (60% del score)
    switch (maxWeight) {
        case 5: // Crítico
            totalScore = 80; // Base 80 para peso 5
            break;
        case 4: // Alto
            totalScore = 60; // Base 60 para peso 4
            break;
        case 3: // Medio
            totalScore = 40; // Base 40 para peso 3
            break;
        case 2: // Bajo
            totalScore = 20; // Base 20 para peso 2
            break;
        case 1: // Mínimo
        default:
            totalScore = 10; // Base 10 para peso 1
    }
    
    // ✅ CORREGIDO: BONUS POR CANTIDAD (máximo +15 puntos)
    const countBonus = Math.min(detectedKeywords.length * 2, 15);
    totalScore += countBonus;
    
    // ✅ CORREGIDO: BONUS POR KEYWORDS DE ALTO PESO (máximo +20 puntos)
    const highWeightBonus = highWeightCount * 10;
    totalScore += Math.min(highWeightBonus, 20);
    
    // ✅ CORREGIDO: BONUS POR KEYWORDS DE PESO MEDIO (máximo +10 puntos)
    const mediumWeightBonus = mediumWeightCount * 3;
    totalScore += Math.min(mediumWeightBonus, 10);
    
    // ✅ ASEGURAR LÍMITES
    totalScore = Math.min(Math.max(totalScore, 0), 100);
    
    console.log(`📊 Desglose score local:`);
    console.log(`   - Base por peso máximo: ${totalScore - countBonus - highWeightBonus - mediumWeightBonus}`);
    console.log(`   - Bonus por cantidad: ${countBonus}`);
    console.log(`   - Bonus alto peso: ${Math.min(highWeightBonus, 20)}`);
    console.log(`   - Bonus medio peso: ${Math.min(mediumWeightBonus, 10)}`);
    console.log(`   - TOTAL: ${totalScore}`);
    
    return totalScore;
}

    /**
     * Convertir score a nivel de riesgo - ACTUALIZADO
     */
    scoreToRiskLevel(score) {
    let level;
    if (score >= 80) level = 'critico';
    else if (score >= 60) level = 'alto';
    else if (score >= 40) level = 'medio';  // ✅ Cambiado de 30 a 40
    else if (score >= 20) level = 'bajo';   // ✅ Cambiado de 10 a 20
    else level = 'minimo';
    
    console.log(`🎯 Score ${score} -> Nivel: ${level}`);
    return level;
}

    /**
     * Extraer contexto alrededor de una palabra clave - MEJORADO
     */
    extractContext(text, keyword, wordsAround = 5) {
        const words = text.split(/\s+/);
        const lowerText = text.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();
        
        // Encontrar la posición de la keyword
        let keywordIndex = -1;
        for (let i = 0; i < words.length; i++) {
            if (words[i].toLowerCase().includes(lowerKeyword)) {
                keywordIndex = i;
                break;
            }
        }
        
        if (keywordIndex === -1) return '';
        
        const start = Math.max(0, keywordIndex - wordsAround);
        const end = Math.min(words.length, keywordIndex + wordsAround + 1);
        
        return words.slice(start, end).join(' ');
    }

    /**
     * Parsear respuesta de DeepSeek
     */
    parseDeepSeekResponse(response) {
        try {
            if (typeof response === 'string') {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
            }
            return response;
        } catch (error) {
            console.error('Error parseando respuesta DeepSeek:', error);
            return null;
        }
    }

    /**
     * Generar resumen del análisis
     */
    generateAnalysisSummary(localAnalysis, deepseekAnalysis, riskLevel) {
        const keywordCount = localAnalysis.detectedKeywords.length;
        
        if (keywordCount === 0) {
            return 'No se detectaron palabras clave de riesgo significativas.';
        }
        
        let summary = `Se detectaron ${keywordCount} palabra(s) clave de riesgo. `;
        
        if (deepseekAnalysis && deepseekAnalysis.emotionalContext) {
            summary += `Contexto emocional: ${deepseekAnalysis.emotionalContext}. `;
        }
        
        summary += `Nivel de riesgo: ${riskLevel.level.toUpperCase()}.`;
        
        return summary;
    }

    /**
     * Análisis básico de riesgo (fallback)
     */
    basicRiskAnalysis(text) {
        console.log('🔄 Usando análisis básico (fallback)');
        // Análisis simple sin dependencias externas
        const lowerText = text.toLowerCase();
        
        // Palabras críticas para detección básica
        const criticalWords = [
            'suicid', 'matar', 'morir', 'acabar', 'suicidio', 'suicidar',
            'no quiero vivir', 'quiero morir', 'me quiero morir'
        ];
        
        let score = 0;
        criticalWords.forEach(word => {
            if (lowerText.includes(word)) {
                score += 20;
            }
        });
        
        score = Math.min(100, score);
        
        let level = 'minimo';
        if (score >= 80) level = 'critico';
        else if (score >= 60) level = 'alto';
        else if (score >= 30) level = 'medio';
        else if (score >= 10) level = 'bajo';
        
        return {
            riskLevel: level,
            riskScore: score,
            detectedKeywords: [],
            contextualAnalysis: null,
            summary: 'Análisis básico realizado',
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new RiskAnalysisService();