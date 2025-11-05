// Constantes de configuración del sistema
module.exports = {
    // Niveles de riesgo
    RISK_LEVELS: {
        CRITICO: 'critico',
        ALTO: 'alto', 
        MODERADO: 'medio',
        LEVE: 'bajo',
        MINIMO: 'minimo'
    },
    
    // URL para solicitud de citas
    APPOINTMENT_URL: 'https://sigepsi.garcessebastian.com/',
    
    // Mensaje de recomendación de cita
    APPOINTMENT_RECOMMENDATION: {
        ALTO_RIESGO: `\n\n💙 **Recurso importante:** Detectamos que podrías beneficiarte de apoyo profesional especializado. Te recomendamos solicitar una cita con un psicólogo en: https://sigepsi.garcessebastian.com/`,
        
        ANSIEDAD_MODERADA: `\n\n💙 **Sugerencia de apoyo:** Para un acompañamiento más continuo, puedes solicitar una cita con especialistas en salud mental en: https://sigepsi.garcessebastian.com/`
    },
    
    // Límites para recomendar citas
    APPOINTMENT_THRESHOLDS: {
        RISK_SCORE: 40, // Score mínimo para recomendar cita
        RISK_LEVELS: ['alto', 'critico'] // Niveles que activan recomendación
    },
    
    // Recursos de emergencia
    EMERGENCY_RESOURCES: {
        LINEA_106: '📞 Línea 106 - Atención en crisis 24/7 (gratuita)',
        LINEA_PURPURA: '💜 Línea Púrpura - 018000112137 (violencia contra mujeres)',
        EPS: '🏥 EPS - Tu entidad de salud tiene servicio de psicología'
    }
};