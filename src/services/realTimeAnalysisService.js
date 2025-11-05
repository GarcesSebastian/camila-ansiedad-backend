const RiskAnalysisService = require('./riskAnalysisService');
const User = require('../models/User');
const Chat = require('../models/Chat');

class RealTimeAnalysisService {
    /**
     * Analizar mensaje en tiempo real y actualizar riesgo del paciente
     */
    async analyzeAndUpdateRisk(userId, message) {
        try {
            const patient = await User.findById(userId).populate('institution');
            
            if (!patient || !patient.institution) {
                return null;
            }

            // Análisis con palabras clave
            const analysis = await RiskAnalysisService.analyzeConversationWithKeywords(
                message,
                patient.institution._id
            );

            // Actualizar perfil del paciente si hay riesgo significativo
            if (analysis.riskLevel === 'alto' || analysis.riskLevel === 'critico') {
                await User.findByIdAndUpdate(userId, {
                    'patientProfile.riskLevel': analysis.riskLevel,
                    'patientProfile.lastRiskAssessment': {
                        riskLevel: analysis.riskLevel,
                        riskScore: analysis.riskScore,
                        assessedAt: new Date(),
                        keywordsDetected: analysis.detectedKeywords.length
                    }
                });

                // Emitir evento en tiempo real (para notificaciones)
                this.emitRiskAlert(patient, analysis);
            }

            return analysis;

        } catch (error) {
            console.error('Error en análisis en tiempo real:', error);
            return null;
        }
    }

    /**
     * Emitir alerta de riesgo (para WebSockets o notificaciones)
     */
    emitRiskAlert(patient, analysis) {
        // Aquí puedes integrar con Socket.io para notificaciones en tiempo real
        console.log(`🚨 ALERTA DE RIESGO - Paciente: ${patient.name}`);
        console.log(`Nivel: ${analysis.riskLevel}, Score: ${analysis.riskScore}`);
        console.log(`Palabras clave detectadas: ${analysis.detectedKeywords.length}`);
        
        // Ejemplo de integración con Socket.io:
        // if (io) {
        //     io.emit('risk_alert', {
        //         patientId: patient._id,
        //         patientName: patient.name,
        //         riskLevel: analysis.riskLevel,
        //         riskScore: analysis.riskScore,
        //         keywords: analysis.detectedKeywords,
        //         timestamp: new Date()
        //     });
        // }
    }

    /**
     * Obtener pacientes de alto riesgo para un experto
     */
    async getHighRiskPatients(expertId) {
        const patients = await User.find({
            'patientProfile.assignedExpert': expertId,
            'patientProfile.riskLevel': { $in: ['alto', 'critico'] },
            'isActive': true
        })
        .populate('institution')
        .sort({ 'patientProfile.lastRiskAssessment.assessedAt': -1 });

        return patients;
    }

    /**
     * Obtener historial de riesgo de un paciente
     */
    async getPatientRiskHistory(patientId, limit = 10) {
        const chats = await Chat.find({
            user: patientId,
            'analysis.keywordAnalysis': { $exists: true }
        })
        .select('analysis.keywordAnalysis riskLevel riskScore createdAt')
        .sort({ createdAt: -1 })
        .limit(limit);

        return chats.map(chat => ({
            timestamp: chat.createdAt,
            riskLevel: chat.analysis.keywordAnalysis.riskLevel,
            riskScore: chat.analysis.keywordAnalysis.riskScore,
            keywords: chat.analysis.keywordAnalysis.detectedKeywords,
            summary: chat.analysis.keywordAnalysis.summary
        }));
    }
}

module.exports = new RealTimeAnalysisService();