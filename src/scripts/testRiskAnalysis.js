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

// Registrar modelos básicos para el test
const registerTestModels = () => {
    if (!mongoose.models.Keyword) {
        const keywordSchema = new mongoose.Schema({
            symptom: String,
            keyword: String,
            weight: Number,
            expertId: mongoose.Schema.Types.ObjectId,
            institution: mongoose.Schema.Types.ObjectId,
            isActive: Boolean
        }, { strict: false, timestamps: true });
        
        mongoose.model('Keyword', keywordSchema);
    }
};

const testRiskAnalysis = async () => {
    try {
        loadEnvFile();
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('🧪 TEST MANUAL DE RISK ANALYSIS\n');
        
        // Registrar modelos antes de cargar el servicio
        registerTestModels();
        
        // Cargar el servicio después de registrar modelos
        const RiskAnalysisService = require('../services/riskAnalysisService');
        
        // Texto de prueba (similar al de Rafael)
        const testText = "me quiero suicidar me siento muy estresado por las tareas ya no aguanto mas me ire a suicidar adios";
        const institutionId = "690422166634815bb827b5a8"; // ID de la institución de Leonardo
        
        console.log('📝 Texto de prueba:', testText);
        console.log('🏫 Institución ID:', institutionId);
        
        // Ejecutar análisis
        console.log('\n🔍 Ejecutando análisis...');
        const analysis = await RiskAnalysisService.analyzeConversationWithKeywords(testText, institutionId);
        
        console.log('\n📊 RESULTADO DEL ANÁLISIS:');
        console.log('========================');
        console.log('Nivel de Riesgo:', analysis.riskLevel);
        console.log('Score:', analysis.riskScore);
        console.log('Keywords Detectadas:', analysis.detectedKeywords.length);
        
        analysis.detectedKeywords.forEach(kw => {
            console.log(`   - "${kw.keyword}" (${kw.symptom}, peso: ${kw.weight})`);
        });
        
        console.log('\nResumen:', analysis.summary);
        
        await mongoose.disconnect();
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
};

testRiskAnalysis();