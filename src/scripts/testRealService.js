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

const testRealService = async () => {
    try {
        loadEnvFile();
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('🧪 TEST DEL SERVICIO REAL\n');
        
        // Consultar directamente la base de datos sin usar modelos complejos
        const db = mongoose.connection.db;
        
        // 1. Obtener palabras clave directamente de la colección
        const institutionId = new mongoose.Types.ObjectId("690422166634815bb827b5a8");
        const keywords = await db.collection('keywords').find({
            institution: institutionId,
            isActive: true
        }).toArray();
        
        console.log('🔤 Palabras clave encontradas:', keywords.length);
        keywords.forEach(kw => {
            console.log(`   - "${kw.keyword}" (${kw.symptom}, peso: ${kw.weight})`);
        });
        
        // 2. Texto de prueba
        const testText = "me quiero suicidar me siento muy estresado por las tareas ya no aguanto mas me ire a suicidar adios";
        
        console.log('\n📝 Texto de prueba:', testText);
        
        // 3. Análisis manual simple
        console.log('\n🔍 ANÁLISIS MANUAL:');
        const lowerText = testText.toLowerCase();
        let detectedCount = 0;
        let totalWeight = 0;
        
        keywords.forEach(kw => {
            if (lowerText.includes(kw.keyword.toLowerCase())) {
                console.log(`   ✅ DETECTADA: "${kw.keyword}" (peso: ${kw.weight})`);
                detectedCount++;
                totalWeight += kw.weight;
            } else {
                console.log(`   ❌ NO detectada: "${kw.keyword}"`);
            }
        });
        
        // 4. Calcular score manual
        console.log('\n📊 CÁLCULO MANUAL:');
        console.log(`   Keywords detectadas: ${detectedCount}`);
        console.log(`   Peso total: ${totalWeight}`);
        
        let score = 0;
        if (detectedCount > 0) {
            // Cálculo similar al del servicio
            const countFactor = Math.min(detectedCount * 8, 40);
            const maxPossibleWeight = keywords.reduce((sum, kw) => sum + kw.weight, 0);
            const weightPercentage = maxPossibleWeight > 0 ? (totalWeight / maxPossibleWeight) * 100 : 0;
            const weightFactor = Math.min(weightPercentage * 0.8, 60);
            
            // Contar keywords de alto peso
            const highWeightKeywords = keywords.filter(kw => 
                kw.weight >= 4 && lowerText.includes(kw.keyword.toLowerCase())
            );
            const highWeightBonus = highWeightKeywords.length * 15;
            
            score = countFactor + weightFactor + highWeightBonus;
            
            console.log(`   - Count Factor: ${countFactor}`);
            console.log(`   - Weight Factor: ${weightFactor}`);
            console.log(`   - High Weight Bonus: ${highWeightBonus}`);
            console.log(`   - SCORE TOTAL: ${score}`);
        }
        
        // 5. Determinar nivel de riesgo
        let riskLevel = 'minimo';
        if (score >= 80) riskLevel = 'critico';
        else if (score >= 60) riskLevel = 'alto';
        else if (score >= 30) riskLevel = 'medio';
        else if (score >= 10) riskLevel = 'bajo';
        
        console.log('\n🎯 RESULTADO:');
        console.log(`   Nivel de Riesgo: ${riskLevel}`);
        console.log(`   Score: ${Math.round(score)}`);
        
        // 6. Verificar conversación existente de Rafael
        console.log('\n🔍 VERIFICANDO CONVERSACIÓN EXISTENTE:');
        const patient = await db.collection('users').findOne({ email: 'rafa@gmail.com' });
        if (patient) {
            const chats = await db.collection('chats').find({ userId: patient._id }).toArray();
            console.log(`   Chats de Rafael: ${chats.length}`);
            
            if (chats.length > 0) {
                const lastChat = chats[0];
                console.log(`   Último chat - Risk Level: ${lastChat.riskLevel || 'N/A'}`);
                console.log(`   Último chat - Risk Score: ${lastChat.riskScore || 'N/A'}`);
                console.log(`   Análisis: ${lastChat.analysis ? 'EXISTE' : 'NO EXISTE'}`);
                
                if (lastChat.analysis) {
                    console.log(`   Keywords en análisis: ${lastChat.analysis.keywordAnalysis?.detectedKeywords?.length || 0}`);
                }
            }
        }
        
        await mongoose.disconnect();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
};

testRealService();