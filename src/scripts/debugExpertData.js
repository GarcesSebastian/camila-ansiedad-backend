const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Configurar variables de entorno manualmente
const loadEnvFile = () => {
    const envPath = path.join(__dirname, '..', '..', '.env');
    
    if (fs.existsSync(envPath)) {
        console.log('📁 Cargando variables de .env:', envPath);
        const envFile = fs.readFileSync(envPath, 'utf8');
        const envVars = envFile.split('\n')
            .filter(line => line && !line.startsWith('#'))
            .reduce((acc, line) => {
                const equalsIndex = line.indexOf('=');
                if (equalsIndex !== -1) {
                    const key = line.substring(0, equalsIndex).trim();
                    const value = line.substring(equalsIndex + 1).trim();
                    const cleanValue = value.replace(/^['"](.*)['"]$/, '$1');
                    if (key && cleanValue) {
                        acc[key] = cleanValue;
                    }
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

// Registrar modelos manualmente
const registerModels = () => {
    console.log('📝 Registrando modelos...');
    
    // Modelo Institution
    const institutionSchema = new mongoose.Schema({
        name: { type: String, required: true },
        type: { 
            type: String, 
            enum: ['university', 'school', 'company', 'health_center', 'other'],
            required: true 
        },
        address: String,
        contactEmail: String,
        phone: String,
        isActive: { type: Boolean, default: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }, { timestamps: true });

    // Modelo User
    const userSchema = new mongoose.Schema({
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        role: { 
            type: String, 
            enum: ['superadmin', 'institutional_admin', 'expert', 'user'],
            default: 'user'
        },
        institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution' },
        isActive: { type: Boolean, default: true },
        
        // Perfil de experto
        expertProfile: {
            specialization: String,
            licenseNumber: String,
            yearsOfExperience: Number,
            assignedPrograms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Program' }],
            assignedFaculties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' }],
            assignedCareers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Career' }],
            currentPatients: { type: Number, default: 0 },
            maxPatients: { type: Number, default: 50 }
        },
        
        // Perfil de paciente
        patientProfile: {
            assignedExpert: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            status: { type: String, enum: ['active', 'inactive', 'discharged'], default: 'active' },
            riskLevel: { type: String, enum: ['minimo', 'bajo', 'medio', 'alto', 'critico'] },
            lastRiskAssessment: {
                riskLevel: String,
                riskScore: Number,
                assessedAt: Date,
                keywordsDetected: Number
            },
            medicalHistory: String,
            emergencyContact: String,
            lastEvaluation: Date
        },
        
        // Ruta institucional
        institutionalPath: {
            program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
            faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
            career: { type: mongoose.Schema.Types.ObjectId, ref: 'Career' },
            semester: String,
            course: String,
            grade: String,
            section: String,
            schedule: String,
            department: String,
            position: String
        },
        
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }, { timestamps: true });

    // Modelo Chat
    const messageSchema = new mongoose.Schema({
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    });

    const chatSchema = new mongoose.Schema({
        userId: { type: mongoose.Schema.Types.Mixed, required: true },
        anonymousId: { type: String, sparse: true },
        title: { type: String, required: true, trim: true, maxlength: 100 },
        messages: [messageSchema],
        riskLevel: {
            type: String,
            enum: ['ALTO', 'MODERADO', 'LEVE', 'MINIMO', 'high', 'medium', 'low', 'minimo', 'critico', 'alto', 'medio', 'bajo', null],
            default: null
        },
        riskScore: { type: Number, min: 0, max: 100, default: null },
        anxietyIndicators: { type: mongoose.Schema.Types.Mixed, default: {} },
        lastRiskAssessment: { type: Date, default: null },
        isAnonymous: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        analysis: { type: mongoose.Schema.Types.Mixed, default: {} },
        institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution' }
    }, { timestamps: true });

    // Modelo Keyword
    const keywordSchema = new mongoose.Schema({
        symptom: {
            type: String,
            required: [true, 'El síntoma es requerido'],
            enum: ['ansiedad', 'depresion', 'insomnio', 'estres', 'panico', 'otros'],
            default: 'ansiedad'
        },
        keyword: { type: String, required: true, trim: true, lowercase: true },
        weight: { type: Number, required: true, min: 1, max: 5, default: 3 },
        expertId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
        isActive: { type: Boolean, default: true }
    }, { timestamps: true });

    // Registrar modelos
    if (!mongoose.models.Institution) mongoose.model('Institution', institutionSchema);
    if (!mongoose.models.User) mongoose.model('User', userSchema);
    if (!mongoose.models.Chat) mongoose.model('Chat', chatSchema);
    if (!mongoose.models.Keyword) mongoose.model('Keyword', keywordSchema);
    
    console.log('✅ Modelos registrados correctamente');
};

const debugExpertData = async (expertId) => {
    try {
        console.log('🔍 INICIANDO DEBUG COMPLETO DEL EXPERTO...');
        
        // Cargar variables de entorno
        loadEnvFile();
        
        const MONGODB_URI = process.env.MONGODB_URI;
        if (!MONGODB_URI) {
            console.log('❌ No se encontró MONGODB_URI');
            return;
        }
        
        console.log('🔗 Conectando a MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
        });
        
        console.log('✅ Conectado a MongoDB exitosamente');
        
        // Registrar modelos
        registerModels();
        
        const User = mongoose.model('User');
        const Chat = mongoose.model('Chat');
        const Keyword = mongoose.model('Keyword');
        
        // 1. VERIFICAR EXPERTO
        console.log('\n📋 1. VERIFICANDO EXPERTO...');
        const expert = await User.findById(expertId)
            .populate('institution', 'name type');
        
        if (!expert) {
            console.log('❌ Experto no encontrado');
            return;
        }
        
        console.log('✅ Experto encontrado:');
        console.log(`   Nombre: ${expert.name}`);
        console.log(`   Email: ${expert.email}`);
        console.log(`   Institución: ${expert.institution?.name} (${expert.institution?.type})`);
        
        // 2. VERIFICAR PACIENTES DEL EXPERTO
        console.log('\n📋 2. VERIFICANDO PACIENTES...');
        const patients = await User.find({
            'patientProfile.assignedExpert': expertId,
            isActive: true,
            role: 'user'
        }).populate('institutionalPath.program', 'name')
          .populate('institutionalPath.faculty', 'name');
        
        console.log(`📊 Total pacientes: ${patients.length}`);
        
        if (patients.length === 0) {
            console.log('❌ No hay pacientes asignados a este experto');
            await mongoose.disconnect();
            return;
        }
        
        // 3. ANÁLISIS DETALLADO POR PACIENTE
        console.log('\n📋 3. ANÁLISIS DETALLADO POR PACIENTE:');
        console.log('======================================');
        
        let totalChats = 0;
        let totalHighRiskChats = 0;
        let patientsWithRiskData = 0;
        let patientsWithChats = 0;
        
        for (let [index, patient] of patients.entries()) {
            console.log(`\n--- PACIENTE ${index + 1}: ${patient.name} ---`);
            console.log(`   Email: ${patient.email}`);
            console.log(`   Programa: ${patient.institutionalPath?.program?.name || 'No asignado'}`);
            
            // Información de riesgo del paciente
            console.log(`   📊 PERFIL DE RIESGO:`);
            console.log(`      - Risk Level: ${patient.patientProfile?.riskLevel || 'No establecido'}`);
            console.log(`      - Last Assessment: ${patient.patientProfile?.lastRiskAssessment?.assessedAt || 'Nunca'}`);
            console.log(`      - Risk Score: ${patient.patientProfile?.lastRiskAssessment?.riskScore || 'N/A'}%`);
            console.log(`      - Keywords Detected: ${patient.patientProfile?.lastRiskAssessment?.keywordsDetected || 0}`);
            
            if (patient.patientProfile?.riskLevel) {
                patientsWithRiskData++;
            }
            
            // 4. VERIFICAR CHATS DEL PACIENTE
            const chats = await Chat.find({ 
                user: patient._id,
                isActive: true 
            }).sort({ createdAt: -1 }).limit(5);
            
            console.log(`   💬 CONVERSACIONES (últimas 5):`);
            console.log(`      - Total chats: ${chats.length}`);
            
            totalChats += chats.length;
            
            if (chats.length > 0) {
                patientsWithChats++;
                
                const highRiskChats = chats.filter(chat => 
                    ['high', 'alto', 'ALTO', 'critico'].includes(chat.riskLevel)
                );
                totalHighRiskChats += highRiskChats.length;
                
                console.log(`      - Chats alto riesgo: ${highRiskChats.length}`);
                console.log(`      - Último chat: ${chats[0].createdAt.toLocaleDateString()}`);
                
                // Mostrar análisis del último chat
                const lastChat = chats[0];
                if (lastChat.analysis) {
                    console.log(`      - Análisis del último chat:`);
                    
                    if (lastChat.analysis.keywordAnalysis) {
                        const ka = lastChat.analysis.keywordAnalysis;
                        console.log(`        * Risk Level: ${ka.riskLevel || 'N/A'}`);
                        console.log(`        * Risk Score: ${ka.riskScore || 'N/A'}%`);
                        console.log(`        * Keywords detectadas: ${ka.detectedKeywords?.length || 0}`);
                    }
                    
                    if (lastChat.riskLevel) {
                        console.log(`        * Risk Level directo: ${lastChat.riskLevel}`);
                    }
                    if (lastChat.riskScore) {
                        console.log(`        * Risk Score directo: ${lastChat.riskScore}%`);
                    }
                } else {
                    console.log(`      - ❌ No hay análisis en el último chat`);
                }
            } else {
                console.log(`      - ❌ No hay conversaciones registradas`);
            }
        }
        
        // 5. VERIFICAR PALABRAS CLAVE DEL EXPERTO
        console.log('\n📋 4. VERIFICANDO PALABRAS CLAVE...');
        const keywords = await Keyword.find({
            expertId: expertId,
            isActive: true
        });
        
        console.log(`🔤 Palabras clave configuradas: ${keywords.length}`);
        
        if (keywords.length > 0) {
            const keywordsBySymptom = keywords.reduce((acc, kw) => {
                acc[kw.symptom] = (acc[kw.symptom] || 0) + 1;
                return acc;
            }, {});
            
            console.log('   Distribución por síntoma:');
            Object.entries(keywordsBySymptom).forEach(([symptom, count]) => {
                console.log(`      - ${symptom}: ${count} palabras`);
            });
        }
        
        // 6. RESUMEN FINAL
        console.log('\n📋 5. RESUMEN FINAL:');
        console.log('===================');
        console.log(`👥 Total pacientes: ${patients.length}`);
        console.log(`📊 Pacientes con datos de riesgo: ${patientsWithRiskData}`);
        console.log(`💬 Pacientes con conversaciones: ${patientsWithChats}`);
        console.log(`💬 Total conversaciones: ${totalChats}`);
        console.log(`⚠️  Conversaciones alto riesgo: ${totalHighRiskChats}`);
        console.log(`🔤 Palabras clave configuradas: ${keywords.length}`);
        
        // DIAGNÓSTICO
        console.log('\n🔍 DIAGNÓSTICO:');
        if (patientsWithRiskData === 0) {
            console.log('❌ PROBLEMA PRINCIPAL: Ningún paciente tiene nivel de riesgo establecido');
            console.log('   Posibles causas:');
            console.log('   1. Los chats no están siendo analizados automáticamente');
            console.log('   2. El servicio RiskAnalysisService no se está ejecutando');
            console.log('   3. Los pacientes no han chateado con Camila');
        } else if (patientsWithChats === 0) {
            console.log('❌ PROBLEMA: Los pacientes no tienen conversaciones');
            console.log('   Solución: Los pacientes necesitan chatear con Camila');
        } else if (totalHighRiskChats === 0) {
            console.log('✅ Los pacientes tienen conversaciones, pero ninguna de alto riesgo');
            console.log('   Esto puede ser normal si los mensajes no contienen palabras clave de riesgo');
        } else {
            console.log('✅ Sistema funcionando correctamente');
        }
        
        await mongoose.disconnect();
        console.log('\n✅ Debug completado');
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
        process.exit(1);
    }
};

// Ejecutar: node src/scripts/debugExpertData.js [expertId]
if (require.main === module) {
    const expertId = process.argv[2];
    if (!expertId) {
        console.log('❌ Usar: node debugExpertData.js [expertId]');
        console.log('💡 Ejemplo: node debugExpertData.js 6904222d6634815bb827b5b7');
        process.exit(1);
    }
    
    if (!mongoose.Types.ObjectId.isValid(expertId)) {
        console.log('❌ ID de experto inválido');
        process.exit(1);
    }
    
    debugExpertData(expertId);
}

module.exports = debugExpertData;