// /backend/src/scripts/debugConversation.js
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

const debugConversation = async (patientEmail) => {
    try {
        loadEnvFile();
        await mongoose.connect(process.env.MONGODB_URI);
        
        // Modelos simples
        const userSchema = new mongoose.Schema({
            name: String, email: String, patientProfile: Object, institutionalPath: Object
        }, { strict: false });
        
        const chatSchema = new mongoose.Schema({
            userId: mongoose.Schema.Types.Mixed, messages: Array, riskLevel: String, 
            riskScore: Number, analysis: Object, title: String
        }, { strict: false });
        
        const keywordSchema = new mongoose.Schema({
            symptom: String, keyword: String, weight: Number, expertId: mongoose.Schema.Types.ObjectId
        }, { strict: false });

        if (!mongoose.models.User) mongoose.model('User', userSchema);
        if (!mongoose.models.Chat) mongoose.model('Chat', chatSchema);
        if (!mongoose.models.Keyword) mongoose.model('Keyword', keywordSchema);

        const User = mongoose.model('User');
        const Chat = mongoose.model('Chat');
        const Keyword = mongoose.model('Keyword');

        console.log('🔍 DEBUG DETALLADO DE CONVERSACIÓN\n');

        // 1. Encontrar al paciente
        const patient = await User.findOne({ email: patientEmail });
        if (!patient) {
            console.log('❌ Paciente no encontrado');
            return;
        }

        console.log(`👤 PACIENTE: ${patient.name} (${patient.email})`);
        console.log(`📊 Risk Level actual: ${patient.patientProfile?.riskLevel || 'N/A'}`);
        console.log(`📈 Risk Score: ${patient.patientProfile?.lastRiskAssessment?.riskScore || 'N/A'}%\n`);

        // 2. Obtener la conversación
        const chats = await Chat.find({ userId: patient._id }).sort({ createdAt: -1 });
        console.log(`💬 Conversaciones encontradas: ${chats.length}`);

        if (chats.length === 0) {
            console.log('❌ No hay conversaciones');
            return;
        }

        const lastChat = chats[0];
        console.log(`\n📝 ÚLTIMA CONVERSACIÓN:`);
        console.log(`   Título: ${lastChat.title}`);
        console.log(`   Fecha: ${lastChat.createdAt}`);
        console.log(`   Risk Level: ${lastChat.riskLevel || 'N/A'}`);
        console.log(`   Risk Score: ${lastChat.riskScore || 'N/A'}%`);

        // 3. Mostrar mensajes
        console.log(`\n💭 MENSAJES:`);
        lastChat.messages.forEach((msg, index) => {
            console.log(`   ${index + 1}. [${msg.role}] ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
        });

        // 4. Mostrar análisis
        console.log(`\n🔍 ANÁLISIS:`);
        if (lastChat.analysis) {
            console.log('   Analysis object:', JSON.stringify(lastChat.analysis, null, 2));
        } else {
            console.log('   ❌ No hay objeto de análisis');
        }

        // 5. Verificar palabras clave del experto
        const expertId = patient.patientProfile?.assignedExpert;
        if (expertId) {
            const keywords = await Keyword.find({ expertId: expertId });
            console.log(`\n🔤 PALABRAS CLAVE DEL EXPERTO (${keywords.length}):`);
            keywords.forEach(kw => {
                console.log(`   - "${kw.keyword}" (${kw.symptom}, peso: ${kw.weight})`);
            });

            // 6. Probar detección manual
            console.log(`\n🧪 PRUEBA DE DETECCIÓN MANUAL:`);
            const allMessages = lastChat.messages.map(m => m.content).join(' ');
            console.log(`   Texto completo: ${allMessages.substring(0, 200)}...`);

            keywords.forEach(kw => {
                const lowerMessage = allMessages.toLowerCase();
                const lowerKeyword = kw.keyword.toLowerCase();
                if (lowerMessage.includes(lowerKeyword)) {
                    console.log(`   ✅ DETECTADA: "${kw.keyword}" en el texto`);
                } else {
                    console.log(`   ❌ NO detectada: "${kw.keyword}"`);
                }
            });
        }

        await mongoose.disconnect();

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
};

// Ejecutar: node debugConversation.js rafa@gmail.com
if (require.main === module) {
    const email = process.argv[2];
    if (!email) {
        console.log('❌ Uso: node debugConversation.js [email_del_paciente]');
        process.exit(1);
    }
    debugConversation(email);
}