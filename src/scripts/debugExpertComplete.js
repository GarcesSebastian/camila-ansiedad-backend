const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Configurar variables de entorno
const loadEnvFile = () => {
    const envPath = path.join(__dirname, '..', '..', '.env');
    if (fs.existsSync(envPath)) {
        console.log('📁 Cargando variables de .env');
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

// Registrar TODOS los modelos necesarios
const registerAllModels = () => {
    console.log('📝 Registrando todos los modelos...');
    
    // Modelo Institution
    const institutionSchema = new mongoose.Schema({
        name: { type: String, required: true },
        type: { type: String, enum: ['university', 'school', 'company', 'health_center', 'other'], required: true },
        address: String,
        contactEmail: String,
        phone: String,
        isActive: { type: Boolean, default: true }
    }, { timestamps: true });

    // Modelo Program
    const programSchema = new mongoose.Schema({
        name: { type: String, required: true },
        description: String,
        type: { type: String, enum: ['undergraduate', 'graduate', 'postgraduate', 'diploma'], default: 'undergraduate' },
        institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        isActive: { type: Boolean, default: true }
    }, { timestamps: true });

    // Modelo Faculty
    const facultySchema = new mongoose.Schema({
        name: { type: String, required: true },
        description: String,
        institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        isActive: { type: Boolean, default: true }
    }, { timestamps: true });

    // Modelo Career
    const careerSchema = new mongoose.Schema({
        name: { type: String, required: true },
        description: String,
        faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
        institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        isActive: { type: Boolean, default: true }
    }, { timestamps: true });

    // Modelo User (simplificado para el debug)
    const userSchema = new mongoose.Schema({
        name: { type: String, required: true },
        email: { type: String, required: true },
        password: { type: String, required: true },
        role: { type: String, enum: ['superadmin', 'institutional_admin', 'expert', 'user'], default: 'user' },
        institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution' },
        isActive: { type: Boolean, default: true },
        expertProfile: {
            currentPatients: { type: Number, default: 0 },
            maxPatients: { type: Number, default: 50 }
        },
        patientProfile: {
            assignedExpert: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            riskLevel: { type: String, enum: ['minimo', 'bajo', 'medio', 'alto', 'critico'] },
            lastRiskAssessment: {
                riskLevel: String,
                riskScore: Number,
                assessedAt: Date,
                keywordsDetected: Number
            }
        },
        institutionalPath: {
            program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
            faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
            career: { type: mongoose.Schema.Types.ObjectId, ref: 'Career' },
            semester: String,
            course: String
        }
    }, { timestamps: true });

    // Modelo Chat (simplificado)
    const messageSchema = new mongoose.Schema({
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    });

    const chatSchema = new mongoose.Schema({
        userId: { type: mongoose.Schema.Types.Mixed, required: true },
        title: { type: String, required: true },
        messages: [messageSchema],
        riskLevel: { type: String },
        riskScore: { type: Number },
        analysis: { type: mongoose.Schema.Types.Mixed, default: {} },
        isActive: { type: Boolean, default: true },
        institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution' }
    }, { timestamps: true });

    // Modelo Keyword
    const keywordSchema = new mongoose.Schema({
        symptom: { type: String, required: true },
        keyword: { type: String, required: true },
        weight: { type: Number, required: true },
        expertId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
        isActive: { type: Boolean, default: true }
    }, { timestamps: true });

    // Registrar todos los modelos
    const models = {
        'Institution': institutionSchema,
        'Program': programSchema,
        'Faculty': facultySchema,
        'Career': careerSchema,
        'User': userSchema,
        'Chat': chatSchema,
        'Keyword': keywordSchema
    };

    Object.entries(models).forEach(([name, schema]) => {
        if (!mongoose.models[name]) {
            mongoose.model(name, schema);
        }
    });
    
    console.log('✅ Todos los modelos registrados');
};

const debugExpertComplete = async (expertId) => {
    try {
        console.log('🔍 DEBUG COMPLETO DEL EXPERTO');
        console.log('=============================\n');
        
        // Configuración
        loadEnvFile();
        const MONGODB_URI = process.env.MONGODB_URI;
        
        if (!MONGODB_URI) {
            console.log('❌ No MONGODB_URI found');
            return;
        }

        console.log('🔗 Conectando a MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
        });
        console.log('✅ Conectado a MongoDB\n');

        // Registrar modelos
        registerAllModels();

        const User = mongoose.model('User');
        const Chat = mongoose.model('Chat');
        const Keyword = mongoose.model('Keyword');

        // 1. INFORMACIÓN DEL EXPERTO
        console.log('1. 📋 INFORMACIÓN DEL EXPERTO');
        console.log('-----------------------------');
        const expert = await User.findById(expertId).populate('institution', 'name type');
        
        if (!expert) {
            console.log('❌ Experto no encontrado');
            return;
        }

        console.log(`   👤 Nombre: ${expert.name}`);
        console.log(`   📧 Email: ${expert.email}`);
        console.log(`   🏫 Institución: ${expert.institution?.name || 'N/A'}`);
        console.log(`   📊 Pacientes asignados: ${expert.expertProfile?.currentPatients || 0}\n`);

        // 2. PACIENTES DEL EXPERTO
        console.log('2. 👥 PACIENTES DEL EXPERTO');
        console.log('---------------------------');
        
        const patients = await User.find({
            'patientProfile.assignedExpert': expertId,
            isActive: true,
            role: 'user'
        }).select('name email patientProfile institutionalPath createdAt');

        console.log(`   📈 Total pacientes: ${patients.length}\n`);

        if (patients.length === 0) {
            console.log('   ❌ No hay pacientes asignados');
            await mongoose.disconnect();
            return;
        }

        // 3. ANÁLISIS POR PACIENTE
        console.log('3. 📊 ANÁLISIS POR PACIENTE');
        console.log('---------------------------');

        let stats = {
            totalPatients: patients.length,
            withRiskLevel: 0,
            withChats: 0,
            totalChats: 0,
            highRiskChats: 0
        };

        for (let patient of patients) {
            console.log(`\n   👤 ${patient.name} (${patient.email})`);
            
            // Información de riesgo
            const riskLevel = patient.patientProfile?.riskLevel;
            const riskScore = patient.patientProfile?.lastRiskAssessment?.riskScore;
            
            console.log(`   📊 Riesgo: ${riskLevel || 'No establecido'} ${riskScore ? `(${riskScore}%)` : ''}`);
            
            if (riskLevel) stats.withRiskLevel++;

            // Chats del paciente
            const chats = await Chat.find({ 
                userId: patient._id,
                isActive: true 
            }).select('riskLevel riskScore analysis createdAt').sort({ createdAt: -1 }).limit(3);

            console.log(`   💬 Chats: ${chats.length}`);
            
            if (chats.length > 0) {
                stats.withChats++;
                stats.totalChats += chats.length;

                const highRiskCount = chats.filter(chat => 
                    ['high', 'alto', 'ALTO', 'critico'].includes(chat.riskLevel)
                ).length;
                stats.highRiskChats += highRiskCount;

                console.log(`   ⚠️  Chats alto riesgo: ${highRiskCount}`);
                
                // Mostrar análisis del último chat
                const lastChat = chats[0];
                if (lastChat.analysis?.keywordAnalysis) {
                    const ka = lastChat.analysis.keywordAnalysis;
                    console.log(`   🔍 Último análisis: ${ka.riskLevel || 'N/A'} (${ka.riskScore || 'N/A'}%)`);
                    console.log(`   🔤 Keywords detectadas: ${ka.detectedKeywords?.length || 0}`);
                } else if (lastChat.riskLevel) {
                    console.log(`   🔍 Riesgo directo: ${lastChat.riskLevel} (${lastChat.riskScore || 'N/A'}%)`);
                } else {
                    console.log(`   🔍 Sin análisis disponible`);
                }
            } else {
                console.log(`   💬 Sin conversaciones`);
            }
        }

        // 4. PALABRAS CLAVE
        console.log('\n4. 🔤 PALABRAS CLAVE CONFIGURADAS');
        console.log('---------------------------------');
        
        const keywords = await Keyword.find({
            expertId: expertId,
            isActive: true
        });

        console.log(`   📝 Total palabras clave: ${keywords.length}`);
        
        if (keywords.length > 0) {
            const bySymptom = keywords.reduce((acc, kw) => {
                acc[kw.symptom] = (acc[kw.symptom] || 0) + 1;
                return acc;
            }, {});
            
            Object.entries(bySymptom).forEach(([symptom, count]) => {
                console.log(`   📌 ${symptom}: ${count} palabras`);
            });
        }

        // 5. RESUMEN Y DIAGNÓSTICO
        console.log('\n5. 📈 RESUMEN FINAL');
        console.log('-------------------');
        console.log(`   👥 Pacientes totales: ${stats.totalPatients}`);
        console.log(`   📊 Con nivel de riesgo: ${stats.withRiskLevel}`);
        console.log(`   💬 Con conversaciones: ${stats.withChats}`);
        console.log(`   💭 Total conversaciones: ${stats.totalChats}`);
        console.log(`   ⚠️  Conversaciones alto riesgo: ${stats.highRiskChats}`);
        console.log(`   🔤 Palabras clave: ${keywords.length}`);

        console.log('\n6. 🔍 DIAGNÓSTICO');
        console.log('----------------');
        
        if (stats.withRiskLevel === 0) {
            console.log('   ❌ PROBLEMA CRÍTICO: Ningún paciente tiene nivel de riesgo');
            console.log('   💡 Posibles causas:');
            console.log('      - Los chats no se están analizando automáticamente');
            console.log('      - El servicio RiskAnalysisService no funciona');
            console.log('      - Los pacientes no han chateado con Camila');
        } else if (stats.withChats === 0) {
            console.log('   ❌ PROBLEMA: Los pacientes no tienen conversaciones');
            console.log('   💡 Solución: Los pacientes deben chatear con Camila');
        } else if (stats.highRiskChats === 0) {
            console.log('   ✅ Los pacientes conversan, pero no hay alto riesgo detectado');
            console.log('   💡 Esto puede ser normal si los mensajes no contienen palabras clave de riesgo');
        } else {
            console.log('   ✅ Sistema funcionando correctamente');
        }

        await mongoose.disconnect();
        console.log('\n✅ Debug completado\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

// Ejecución
if (require.main === module) {
    const expertId = process.argv[2];
    if (!expertId) {
        console.log('❌ Uso: node debugExpertComplete.js [expertId]');
        console.log('💡 Ejemplo: node debugExpertComplete.js 6904222d6634815bb827b5b7');
        process.exit(1);
    }
    debugExpertComplete(expertId);
}

module.exports = debugExpertComplete;