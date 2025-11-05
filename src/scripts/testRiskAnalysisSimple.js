const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const loadEnvFile = () => {
    const envPath = path.join(__dirname, '..', '..', '.env');
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8');
        const envVars = envFile.split('\n')
            .filter(line => line && !line.startsWith('#'))
            .reduce((acc, line) => {
                const equalsIndex = line.indexOf('=');
                if (equalsIndex !== -1) {
                    const key = line.substring(0, equalsIndex).trim();
                    const value = line.substring(equalsIndex + 1).trim();
                    const cleanValue = value.replace(/^['"](.*)['"]$/, '$1');
                    if (key && cleanValue) acc[key] = cleanValue;
                }
                return acc;
            }, {});
        
        Object.keys(envVars).forEach(key => {
            process.env[key] = envVars[key];
        });
        return true;
    }
    return false;
};

// Servicio de análisis simplificado para testing
class TestRiskAnalysis {
    /**
     * Análisis local mejorado de palabras clave
     */
    localKeywordAnalysis(text, keywords) {
        console.log('🔍 Ejecutando análisis local de keywords...');
        const lowerText = text.toLowerCase();
        const detectedKeywords = [];
        let totalWeight = 0;
        
        keywords.forEach(keyword => {
            // Buscar la palabra clave en el texto
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
     * Búsqueda mejorada de palabras clave
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
            return keywordWords.every(word => normalizedText.includes(word));
        }
        
        // 3. Búsqueda por variaciones
        const baseWord = normalizedKeyword.replace(/s$/, '');
        if (baseWord !== normalizedKeyword && normalizedText.includes(baseWord)) {
            return true;
        }
        
        return false;
    }

    /**
     * Extraer contexto alrededor de una palabra clave
     */
    extractContext(text, keyword, wordsAround = 5) {
        const words = text.split(/\s+/);
        const lowerText = text.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();
        
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
     * Calcular score de riesgo
     */
    calculateLocalRiskScore(localAnalysis) {
        const { detectedKeywords, totalWeight, weightPercentage } = localAnalysis;
        
        if (detectedKeywords.length === 0) {
            console.log('📊 Score local: 0 (no keywords detectadas)');
            return 0;
        }
        
        // Factor por cantidad de palabras clave
        const countFactor = Math.min(detectedKeywords.length * 8, 40);
        
        // Factor por peso total
        const weightFactor = Math.min(weightPercentage * 0.8, 60);
        
        // Bonus por palabras de alto peso (4-5)
        const highWeightCount = detectedKeywords.filter(kw => kw.weight >= 4).length;
        const highWeightBonus = highWeightCount * 15;
        
        const totalScore = countFactor + weightFactor + highWeightBonus;
        
        console.log(`📊 Cálculo score local:`);
        console.log(`   - Count Factor: ${countFactor} (${detectedKeywords.length} keywords)`);
        console.log(`   - Weight Factor: ${weightFactor} (${weightPercentage}%)`);
        console.log(`   - High Weight Bonus: ${highWeightBonus} (${highWeightCount} keywords alto peso)`);
        console.log(`   - TOTAL: ${totalScore}`);
        
        return Math.min(100, totalScore);
    }

    /**
     * Convertir score a nivel de riesgo
     */
    scoreToRiskLevel(score) {
        let level;
        if (score >= 80) level = 'critico';
        else if (score >= 60) level = 'alto';
        else if (score >= 30) level = 'medio';
        else if (score >= 10) level = 'bajo';
        else level = 'minimo';
        
        console.log(`🎯 Score ${score} -> Nivel: ${level}`);
        return level;
    }

    /**
     * Análisis completo
     */
    async analyzeConversationWithKeywords(conversationText, keywords) {
        try {
            console.log('🔍 Iniciando análisis de riesgo...');
            console.log('📝 Texto a analizar:', conversationText);
            console.log('🔤 Palabras clave disponibles:', keywords.length);
            keywords.forEach(kw => {
                console.log(`   - "${kw.keyword}" (${kw.symptom}, peso: ${kw.weight})`);
            });
            
            // Análisis local con palabras clave
            const localAnalysis = this.localKeywordAnalysis(conversationText, keywords);
            
            // Calcular nivel de riesgo final
            const localScore = this.calculateLocalRiskScore(localAnalysis);
            const riskLevel = this.scoreToRiskLevel(localScore);
            
            return {
                riskLevel: riskLevel,
                riskScore: localScore,
                detectedKeywords: localAnalysis.detectedKeywords,
                summary: `Se detectaron ${localAnalysis.detectedKeywords.length} palabra(s) clave. Nivel de riesgo: ${riskLevel.toUpperCase()}.`,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error en análisis de riesgo:', error);
            return this.basicRiskAnalysis(conversationText);
        }
    }

    basicRiskAnalysis(text) {
        console.log('🔄 Usando análisis básico (fallback)');
        return {
            riskLevel: 'minimo',
            riskScore: 0,
            detectedKeywords: [],
            summary: 'Análisis básico realizado',
            timestamp: new Date().toISOString()
        };
    }
}

const testRiskAnalysisSimple = async () => {
    try {
        loadEnvFile();
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('🧪 TEST SIMPLIFICADO DE RISK ANALYSIS\n');
        
        // Crear instancia del servicio de prueba
        const testService = new TestRiskAnalysis();
        
        // Texto de prueba (similar al de Rafael)
        const testText = "me quiero suicidar me siento muy estresado por las tareas ya no aguanto mas me ire a suicidar adios";
        
        // Palabras clave de prueba (simulando las de la base de datos)
        const testKeywords = [
            { keyword: "suicidar", symptom: "ansiedad", weight: 5 },
            { keyword: "abrumado", symptom: "ansiedad", weight: 1 },
            { keyword: "estresado", symptom: "estres", weight: 3 },
            { keyword: "no aguanto", symptom: "ansiedad", weight: 4 }
        ];
        
        console.log('📝 Texto de prueba:', testText);
        console.log('🔤 Palabras clave de prueba:', testKeywords.length);
        
        // Ejecutar análisis
        console.log('\n🔍 Ejecutando análisis...');
        const analysis = await testService.analyzeConversationWithKeywords(testText, testKeywords);
        
        console.log('\n📊 RESULTADO DEL ANÁLISIS:');
        console.log('========================');
        console.log('Nivel de Riesgo:', analysis.riskLevel);
        console.log('Score:', analysis.riskScore);
        console.log('Keywords Detectadas:', analysis.detectedKeywords.length);
        
        analysis.detectedKeywords.forEach(kw => {
            console.log(`   - "${kw.keyword}" (${kw.symptom}, peso: ${kw.weight}) - Contexto: "${kw.context}"`);
        });
        
        console.log('\nResumen:', analysis.summary);
        
        // Verificación manual
        console.log('\n🧪 VERIFICACIÓN MANUAL:');
        const lowerText = testText.toLowerCase();
        testKeywords.forEach(kw => {
            const found = lowerText.includes(kw.keyword.toLowerCase());
            console.log(`   ${found ? '✅' : '❌'} "${kw.keyword}" - ${found ? 'DETECTADA' : 'NO detectada'}`);
        });
        
        await mongoose.disconnect();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
};

testRiskAnalysisSimple();