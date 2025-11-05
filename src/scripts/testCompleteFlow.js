// /backend/src/scripts/testCompleteFlow.js
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

const testCompleteFlow = async () => {
    try {
        loadEnvFile();
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('🧪 TEST DE FLUJO COMPLETO - Creación y Análisis\n');
        
        const db = mongoose.connection.db;
        
        // 1. Crear un paciente de prueba
        console.log('1. 👤 CREANDO PACIENTE DE PRUEBA...');
        const newPatient = {
            name: "Paciente Test Analisis",
            email: "test_analisis_" + Date.now() + "@gmail.com",
            password: "test123",
            role: "user",
            institution: new mongoose.Types.ObjectId("690422166634815bb827b5a8"),
            isActive: true,
            patientProfile: {
                assignedExpert: new mongoose.Types.ObjectId("6904222d6634815bb827b5b7"),
                status: "active"
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const patientResult = await db.collection('users').insertOne(newPatient);
        const patientId = patientResult.insertedId;
        console.log('   ✅ Paciente creado:', newPatient.email);
        
        // 2. Simular envío de mensaje de alto riesgo
        console.log('\n2. 💬 SIMULANDO MENSAJE DE ALTO RIESGO...');
        const highRiskMessage = "me quiero suicidar, no aguanto más esta situación";
        
        // Crear chat
        const chatData = {
            title: highRiskMessage.substring(0, 50) + '...',
            userId: patientId,
            institution: newPatient.institution,
            messages: [
                {
                    role: 'user',
                    content: highRiskMessage,
                    timestamp: new Date()
                }
            ],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const chatResult = await db.collection('chats').insertOne(chatData);
        const chatId = chatResult.insertedId;
        console.log('   ✅ Chat creado con mensaje de alto riesgo');
        
        // 3. Simular análisis automático
        console.log('\n3. 🔍 SIMULANDO ANÁLISIS AUTOMÁTICO...');
        
        // Obtener palabras clave
        const keywords = await db.collection('keywords').find({
            institution: newPatient.institution,
            isActive: true
        }).toArray();
        
        console.log('   🔤 Palabras clave disponibles:', keywords.length);
        
        // Análisis manual (simulando lo que debería hacer el controller)
        const lowerText = highRiskMessage.toLowerCase();
        let detectedKeywords = [];
        let totalWeight = 0;
        
        keywords.forEach(kw => {
            if (lowerText.includes(kw.keyword.toLowerCase())) {
                console.log(`   ✅ DETECTADA: "${kw.keyword}" (peso: ${kw.weight})`);
                detectedKeywords.push(kw);
                totalWeight += kw.weight;
            }
        });
        
        // Calcular riesgo
        let riskScore = 0;
        let riskLevel = 'minimo';
        
        if (detectedKeywords.length > 0) {
            const countFactor = Math.min(detectedKeywords.length * 8, 40);
            const maxPossibleWeight = keywords.reduce((sum, kw) => sum + kw.weight, 0);
            const weightPercentage = maxPossibleWeight > 0 ? (totalWeight / maxPossibleWeight) * 100 : 0;
            const weightFactor = Math.min(weightPercentage * 0.8, 60);
            
            const highWeightCount = detectedKeywords.filter(kw => kw.weight >= 4).length;
            const highWeightBonus = highWeightCount * 15;
            
            riskScore = countFactor + weightFactor + highWeightBonus;
            riskScore = Math.min(100, Math.round(riskScore));
            
            if (riskScore >= 80) riskLevel = 'critico';
            else if (riskScore >= 60) riskLevel = 'alto';
            else if (riskScore >= 30) riskLevel = 'medio';
            else if (riskScore >= 10) riskLevel = 'bajo';
        }
        
        console.log(`   📊 Risk Score calculado: ${riskScore}`);
        console.log(`   🎯 Risk Level calculado: ${riskLevel}`);
        
        // 4. Actualizar chat y paciente (como lo haría el controller)
        console.log('\n4. 💾 ACTUALIZANDO DATOS...');
        
        await db.collection('chats').updateOne(
            { _id: chatId },
            {
                $set: {
                    riskLevel: riskLevel.toUpperCase(),
                    riskScore: riskScore,
                    analysis: {
                        keywordAnalysis: {
                            riskLevel: riskLevel,
                            riskScore: riskScore,
                            detectedKeywords: detectedKeywords,
                            summary: `Análisis automático: ${detectedKeywords.length} keywords detectadas`
                        }
                    },
                    lastRiskAssessment: new Date()
                }
            }
        );
        
        await db.collection('users').updateOne(
            { _id: patientId },
            {
                $set: {
                    'patientProfile.riskLevel': riskLevel,
                    'patientProfile.lastRiskAssessment': {
                        riskLevel: riskLevel,
                        riskScore: riskScore,
                        assessedAt: new Date(),
                        keywordsDetected: detectedKeywords.length
                    }
                }
            }
        );
        
        console.log('   ✅ Datos actualizados correctamente');
        
        // 5. Verificar resultados
        console.log('\n5. 🔍 VERIFICANDO RESULTADOS...');
        
        const updatedChat = await db.collection('chats').findOne({ _id: chatId });
        const updatedPatient = await db.collection('users').findOne({ _id: patientId });
        
        console.log(`   💬 Chat - Risk Level: ${updatedChat.riskLevel}`);
        console.log(`   💬 Chat - Risk Score: ${updatedChat.riskScore}`);
        console.log(`   👤 Paciente - Risk Level: ${updatedPatient.patientProfile?.riskLevel}`);
        console.log(`   👤 Paciente - Risk Score: ${updatedPatient.patientProfile?.lastRiskAssessment?.riskScore}`);
        
        // 6. Limpiar (opcional)
        console.log('\n6. 🧹 LIMPIANDO DATOS DE PRUEBA...');
        await db.collection('users').deleteOne({ _id: patientId });
        await db.collection('chats').deleteOne({ _id: chatId });
        console.log('   ✅ Datos de prueba eliminados');
        
        console.log('\n✅ TEST COMPLETADO EXITOSAMENTE');
        console.log('💡 El flujo debería funcionar así en producción');
        
        await mongoose.disconnect();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
};

testCompleteFlow();