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

// Función auxiliar para extraer contexto
function extractContext(text, keyword, wordsAround = 5) {
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

const reanalyzeRafael = async () => {
    try {
        loadEnvFile();
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('🔄 RE-ANALIZANDO CONVERSACIÓN DE RAFAEL\n');
        
        const db = mongoose.connection.db;
        
        // 1. Encontrar a Rafael
        const rafael = await db.collection('users').findOne({ email: 'rafa@gmail.com' });
        if (!rafael) {
            console.log('❌ Rafael no encontrado');
            return;
        }
        
        console.log(`👤 Paciente: ${rafael.name} (${rafael.email})`);
        console.log(`📊 Risk Level actual: ${rafael.patientProfile?.riskLevel || 'N/A'}`);
        
        // 2. Obtener la conversación
        const chat = await db.collection('chats').findOne({ userId: rafael._id });
        if (!chat) {
            console.log('❌ No hay conversación');
            return;
        }
        
        console.log(`💬 Conversación: "${chat.title}"`);
        console.log(`📅 Fecha: ${chat.createdAt}`);
        console.log(`🔍 Risk Level actual: ${chat.riskLevel || 'N/A'}`);
        console.log(`📈 Risk Score actual: ${chat.riskScore || 'N/A'}`);
        
        // 3. Obtener todas las palabras clave de la institución
        const institutionId = rafael.institution;
        const keywords = await db.collection('keywords').find({
            institution: institutionId,
            isActive: true
        }).toArray();
        
        console.log(`🔤 Palabras clave disponibles: ${keywords.length}`);
        
        // 4. Combinar todos los mensajes para análisis
        const allMessages = chat.messages.map(m => m.content).join(' ');
        console.log(`📝 Texto completo (${allMessages.length} caracteres):`);
        console.log(`   "${allMessages.substring(0, 100)}..."`);
        
        // 5. Análisis manual mejorado
        console.log('\n🔍 EJECUTANDO ANÁLISIS...');
        const lowerText = allMessages.toLowerCase();
        let detectedKeywords = [];
        let totalWeight = 0;
        
        keywords.forEach(kw => {
            if (lowerText.includes(kw.keyword.toLowerCase())) {
                console.log(`   ✅ DETECTADA: "${kw.keyword}" (peso: ${kw.weight})`);
                detectedKeywords.push({
                    keyword: kw.keyword,
                    symptom: kw.symptom,
                    weight: kw.weight,
                    context: extractContext(allMessages, kw.keyword) // CORREGIDO: usar la función directamente
                });
                totalWeight += kw.weight;
            } else {
                console.log(`   ❌ NO detectada: "${kw.keyword}"`);
            }
        });
        
        console.log(`\n📊 RESULTADO ANÁLISIS:`);
        console.log(`   Keywords detectadas: ${detectedKeywords.length}`);
        console.log(`   Peso total: ${totalWeight}`);
        
        // 6. Calcular nuevo score y riesgo
        let newScore = 0;
        let newRiskLevel = 'minimo';
        
        if (detectedKeywords.length > 0) {
            const countFactor = Math.min(detectedKeywords.length * 8, 40);
            const maxPossibleWeight = keywords.reduce((sum, kw) => sum + kw.weight, 0);
            const weightPercentage = maxPossibleWeight > 0 ? (totalWeight / maxPossibleWeight) * 100 : 0;
            const weightFactor = Math.min(weightPercentage * 0.8, 60);
            
            const highWeightCount = detectedKeywords.filter(kw => kw.weight >= 4).length;
            const highWeightBonus = highWeightCount * 15;
            
            newScore = countFactor + weightFactor + highWeightBonus;
            newScore = Math.min(100, Math.round(newScore));
            
            if (newScore >= 80) newRiskLevel = 'critico';
            else if (newScore >= 60) newRiskLevel = 'alto';
            else if (newScore >= 30) newRiskLevel = 'medio';
            else if (newScore >= 10) newRiskLevel = 'bajo';
            
            console.log(`   - Count Factor: ${countFactor}`);
            console.log(`   - Weight Factor: ${weightFactor}`);
            console.log(`   - High Weight Bonus: ${highWeightBonus}`);
            console.log(`   - NUEVO SCORE: ${newScore}`);
            console.log(`   - NUEVO RISK LEVEL: ${newRiskLevel}`);
            
            // Mostrar contexto de las keywords detectadas
            console.log(`\n🔍 CONTEXTO DE KEYWORDS DETECTADAS:`);
            detectedKeywords.forEach(kw => {
                console.log(`   - "${kw.keyword}": "${kw.context}"`);
            });
        } else {
            console.log('   ❌ No se detectaron keywords');
        }
        
        // 7. Actualizar la conversación en la base de datos
        console.log('\n💾 ACTUALIZANDO BASE DE DATOS...');
        
        const updateResult = await db.collection('chats').updateOne(
            { _id: chat._id },
            {
                $set: {
                    riskLevel: newRiskLevel.toUpperCase(),
                    riskScore: newScore,
                    analysis: {
                        keywordAnalysis: {
                            riskLevel: newRiskLevel,
                            riskScore: newScore,
                            detectedKeywords: detectedKeywords,
                            summary: `Se detectaron ${detectedKeywords.length} palabra(s) clave de riesgo. Nivel: ${newRiskLevel.toUpperCase()}.`
                        }
                    },
                    lastRiskAssessment: new Date()
                }
            }
        );
        
        console.log(`   ✅ Chat actualizado: ${updateResult.modifiedCount} documento modificado`);
        
        // 8. Actualizar el perfil del paciente
        const patientUpdate = await db.collection('users').updateOne(
            { _id: rafael._id },
            {
                $set: {
                    'patientProfile.riskLevel': newRiskLevel,
                    'patientProfile.lastRiskAssessment': {
                        riskLevel: newRiskLevel,
                        riskScore: newScore,
                        assessedAt: new Date(),
                        keywordsDetected: detectedKeywords.length
                    }
                }
            }
        );
        
        console.log(`   ✅ Paciente actualizado: ${patientUpdate.modifiedCount} documento modificado`);
        
        // 9. Verificar los cambios
        console.log('\n🔍 VERIFICANDO CAMBIOS...');
        const updatedChat = await db.collection('chats').findOne({ _id: chat._id });
        const updatedPatient = await db.collection('users').findOne({ _id: rafael._id });
        
        console.log(`   💬 Chat - Nuevo Risk Level: ${updatedChat.riskLevel}`);
        console.log(`   💬 Chat - Nuevo Risk Score: ${updatedChat.riskScore}`);
        console.log(`   👤 Paciente - Nuevo Risk Level: ${updatedPatient.patientProfile?.riskLevel}`);
        console.log(`   👤 Paciente - Nuevo Score: ${updatedPatient.patientProfile?.lastRiskAssessment?.riskScore}`);
        
        console.log('\n✅ RE-ANÁLISIS COMPLETADO EXITOSAMENTE');
        
        // 10. Mostrar resumen final
        console.log('\n🎯 RESUMEN FINAL:');
        console.log('================');
        console.log(`🔴 ANTERIOR: Risk Level = ${chat.riskLevel || 'N/A'}, Score = ${chat.riskScore || 'N/A'}`);
        console.log(`🟢 ACTUAL: Risk Level = ${newRiskLevel.toUpperCase()}, Score = ${newScore}`);
        console.log(`📈 MEJORA: ${detectedKeywords.length} keywords detectadas vs 0 anteriormente`);
        
        await mongoose.disconnect();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
};

reanalyzeRafael();