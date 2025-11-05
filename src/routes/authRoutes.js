const express = require('express');
const { register, login, logout, getProfile, registerInstitutionalAdmin } = require('../controllers/authController');
const { validateRegister } = require('../middleware/validation');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ✅ NUEVA RUTA: Términos y condiciones - AGREGADA AL ROUTER DE AUTH
router.get('/terms', (req, res) => {
    try {
        console.log('📋 Términos y condiciones solicitados desde authRoutes');
        res.json({
            success: true,
            data: {
                title: 'Términos y Condiciones - Camila',
                lastUpdated: 'Octubre 2025',
                content: `
                    <h1>Términos y Condiciones</h1>
                    <p><strong>Última actualización:</strong> Octubre 2025</p>
                    
                    <h2>1. Aceptación de los Términos</h2>
                    <p>Al acceder y utilizar el asistente Camila, usted acepta estar sujeto a estos términos y condiciones de uso. Si no está de acuerdo con alguna parte de estos términos, no debe utilizar este servicio.</p>
                    
                    <h2>2. Descripción del Servicio</h2>
                    <p>Camila es un asistente virtual basado en Inteligencia Artificial Generativa diseñado para proporcionar información y orientación sobre estrategias de afrontamiento para trastornos mentales. El servicio es ofrecido por Instituciones de Educación Superior como apoyo a su comunidad académica.</p>
                    
                    <h2>3. Uso del Servicio</h2>
                    <p>El usuario se compromete a:</p>
                    <ul>
                        <li>Utilizar el servicio de manera responsable y ética</li>
                        <li>Proporcionar información veraz al interactuar con el asistente</li>
                        <li>No utilizar el servicio para fines ilegales o no autorizados</li>
                        <li>No intentar comprometer la seguridad o integridad del sistema</li>
                        <li>Respetar los derechos de propiedad intelectual del contenido</li>
                    </ul>
                    
                    <h2>4. Limitaciones del Servicio</h2>
                    <p>Camila proporciona información general y orientación sobre estrategias de afrontamiento en salud mental como acciones que se toman para manejar situaciones difíciles y obstáculos diarios. Este servicio <strong>NO constituye el acompañamiento de un profesional o terapeuta</strong>. Para casos específicos, se recomienda solicitar una cita de asesoría psicológica en la institución donde se encuentre afiliado.</p>
                    
                    <h2>5. Privacidad y Datos Personales</h2>
                    <p>La información que usted proporciona a Camila será tratada de acuerdo con las leyes de protección de datos personales de Colombia. Los datos recopilados incluyen:</p>
                    <ul>
                        <li>Edad, Género, Afiliación</li>
                        <li>Contenido de las conversaciones con el asistente virtual</li>
                        <li>Valoraciones (me gusta/no me gusta) de las respuestas</li>
                    </ul>
                    <p>Estos datos se utilizan exclusivamente para mejorar el servicio y proporcionar estadísticas agregadas. No se compartirán con terceros sin su consentimiento expreso.</p>
                    
                    <h2>6. Valoración de Respuestas</h2>
                    <p>El sistema de valoración (me gusta/no me gusta) nos ayuda a mejorar la calidad de las respuestas. Al proporcionar su valoración, usted acepta que esta información sea utilizada para fines de mejora del servicio.</p>
                    
                    <h2>7. Disponibilidad del Servicio</h2>
                    <p>Nos esforzamos por mantener el servicio disponible de manera continua, pero no garantizamos que estará libre de interrupciones o errores. Nos reservamos el derecho de modificar, suspender o discontinuar el servicio en cualquier momento sin previo aviso.</p>
                    
                    <h2>8. Modificaciones a los Términos</h2>
                    <p>Nos reservamos el derecho de modificar estos términos y condiciones en cualquier momento. Los cambios entrarán en vigor inmediatamente después de su publicación en esta página. Es responsabilidad del usuario revisar periódicamente estos términos.</p>
                    
                    <h2>9. Contacto</h2>
                    <p>Para preguntas o inquietudes sobre estos términos y condiciones, puede contactar a <a href="mailto:mbonfanter@gmail.com">mbonfanter@gmail.com</a>.</p>
                    
                    <h2>10. Ley Aplicable</h2>
                    <p>Estos términos y condiciones se rigen por las leyes de la República de Colombia. Cualquier disputa relacionada con estos términos será resuelta en los tribunales competentes de Colombia.</p>
                `
            }
        });
    } catch (error) {
        console.error('Error en ruta de términos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Rutas existentes
router.post('/register', validateRegister, register);
router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/profile', protect, getProfile);

// Nueva ruta para registro de admins institucionales (solo superadmin)
router.post('/register-institutional-admin', protect, registerInstitutionalAdmin);

module.exports = router;