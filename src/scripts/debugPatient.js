const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// ✅ CARGAR TODOS LOS MODELOS NECESARIOS
require('../models/Institution');
require('../models/User');
require('../models/Chat');
require('../models/Keyword');
require('../models/Program');
require('../models/Faculty');
require('../models/Career');

async function debugPatient(patientEmail) {
    try {
        console.log(`🔧 Debugging paciente: ${patientEmail}`);
        
        const mongoUri = process.env.MONGODB_URI;
        await mongoose.connect(mongoUri);
        console.log('✅ Conectado a MongoDB');

        const User = mongoose.model('User');
        const Chat = mongoose.model('Chat');
        const Institution = mongoose.model('Institution');

        // Buscar paciente
        const patient = await User.findOne({ email: patientEmail })
            .populate('institution')
            .populate('patientProfile.assignedExpert');

        if (!patient) {
            throw new Error('Paciente no encontrado');
        }

        console.log('\n📋 INFORMACIÓN DEL PACIENTE:');
        console.log('👤 Nombre:', patient.name);
        console.log('📧 Email:', patient.email);
        console.log('🆔 ID:', patient._id);
        console.log('🏫 Institución:', patient.institution ? `${patient.institution.name} (${patient.institution._id})` : 'Ninguna');
        console.log('👨‍⚕️ Experto asignado:', patient.patientProfile?.assignedExpert?.name || 'Ninguno');
        
        console.log('\n📊 patientProfile COMPLETO:');
        if (patient.patientProfile) {
            console.log(JSON.stringify(patient.patientProfile, null, 2));
        } else {
            console.log('❌ patientProfile NO EXISTE');
        }

        console.log('\n🔍 Estructura de patientProfile:');
        console.log('- riskLevel:', patient.patientProfile?.riskLevel || 'NO DEFINIDO');
        console.log('- lastRiskAssessment:', patient.patientProfile?.lastRiskAssessment ? 'EXISTE' : 'NO EXISTE');
        console.log('- lastEvaluation:', patient.patientProfile?.lastEvaluation || 'NUNCA');
        console.log('- status:', patient.patientProfile?.status || 'NO DEFINIDO');

        // Verificar si el paciente tiene chats
        const chatCount = await Chat.countDocuments({ user: patient._id });
        console.log(`\n💬 Total de chats: ${chatCount}`);

        if (chatCount > 0) {
            const lastChats = await Chat.find({ user: patient._id })
                .sort({ createdAt: -1 })
                .limit(3);

            console.log(`\n📝 Últimos ${lastChats.length} chats:`);
            lastChats.forEach((chat, index) => {
                const userMessage = chat.messages.find(m => m.role === 'user');
                console.log(`\n   ${index + 1}. ${chat.createdAt.toLocaleString()}`);
                console.log(`      Mensaje: "${userMessage?.content?.substring(0, 50)}..."`);
                console.log(`      Riesgo en chat: ${chat.riskLevel} (${chat.riskScore}%)`);
                
                if (chat.analysis?.keywordAnalysis) {
                    console.log(`      🔑 Palabras clave detectadas: ${chat.analysis.keywordAnalysis.detectedKeywords.length}`);
                    chat.analysis.keywordAnalysis.detectedKeywords.forEach(kw => {
                        console.log(`         - "${kw.keyword}" (${kw.symptom}, peso: ${kw.weight})`);
                    });
                } else {
                    console.log(`      🔍 Sin análisis de palabras clave`);
                }
            });
        }

        // Verificar palabras clave de la institución
        if (patient.institution) {
            const Keyword = mongoose.model('Keyword');
            const keywordCount = await Keyword.countDocuments({ 
                institution: patient.institution._id,
                isActive: true 
            });
            console.log(`\n🔑 Palabras clave en la institución: ${keywordCount}`);
            
            if (keywordCount > 0) {
                const sampleKeywords = await Keyword.find({ 
                    institution: patient.institution._id,
                    isActive: true 
                }).limit(5);
                
                console.log('   Ejemplos:');
                sampleKeywords.forEach(kw => {
                    console.log(`   - "${kw.keyword}" (${kw.symptom}, peso: ${kw.weight})`);
                });
            }
        }

        console.log('\n✅ Debug completado');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Desconectado de MongoDB');
    }
}

// Usar: node debugPatient.js email_del_paciente@ejemplo.com
const patientEmail = process.argv[2];
if (!patientEmail) {
    console.log('❌ Proporciona el email: node debugPatient.js email@ejemplo.com');
    process.exit(1);
}

debugPatient(patientEmail);