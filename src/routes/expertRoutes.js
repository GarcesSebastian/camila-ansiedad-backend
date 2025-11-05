const express = require('express');
const router = express.Router();
const expertController = require('../controllers/expertController');
const { protect, authorize } = require('../middleware/auth'); // ✅ Ya está importado
const upload = require('../middleware/uploadMiddleware');

// Todas las rutas requieren autenticación y rol de experto
router.use(protect);
router.use(authorize('expert'));

// Dashboard y estadísticas
router.get('/dashboard/stats', expertController.getDashboardStats);

// Gestión de pacientes
router.post('/patients', expertController.createPatient);
router.get('/patients', expertController.getMyPatients);
router.get('/patients/analysis/:patientId', expertController.getPatientAnalysis);
router.post('/patients/:patientId/analyze', expertController.analyzePatient);
router.get('/patients/:patientId/analyze', expertController.analyzePatient);

// Estructura institucional
router.get('/institution/structure/:institutionId', expertController.getInstitutionStructure);

// Gestión de recomendaciones
router.post('/recommendations', expertController.createRecommendation);
router.get('/recommendations', expertController.getMyRecommendations);
router.put('/recommendations/:recommendationId', expertController.updateRecommendation);
router.get('/reports/weekly', expertController.getWeeklyPatientReports);

// Gestión universitaria
router.post('/programs', expertController.createProgram);
router.post('/faculties', expertController.createFaculty);
router.get('/programs', expertController.getMyPrograms);
router.put('/programs/:programId', expertController.updateProgram);
router.delete('/programs/:programId', expertController.deleteProgram);
router.get('/faculties', expertController.getMyFaculties);
router.put('/faculties/:facultyId', expertController.updateFaculty);
router.delete('/faculties/:facultyId', expertController.deleteFaculty);

// Gestión de palabras clave para ansiedad
router.post('/keywords', expertController.addKeyword);
router.get('/keywords', expertController.getMyKeywords);
router.get('/keywords/symptom/:symptom', expertController.getKeywordsBySymptom);
router.put('/keywords/:keywordId', expertController.updateKeyword);
router.delete('/keywords/:keywordId', expertController.deleteKeyword);

// Gestión de documentos de crisis
router.post('/documents', upload.single('document'), expertController.uploadDocument);
router.get('/documents', expertController.getMyDocuments);
router.get('/documents/category/:category', expertController.getDocumentsByCategory);
router.delete('/documents/:documentId', expertController.deleteDocument);
router.patch('/documents/:documentId/download', expertController.incrementDownloadCount);

// ✅ CORREGIDO: RUTAS PARA ANÁLISIS CON PALABRAS CLAVE
router.post('/analyze/conversation', expertController.analyzeConversationWithKeywords);
router.get('/keywords/stats', expertController.getKeywordStats);
router.post('/keywords/test', expertController.testKeyword);

router.get('/patients/:patientId/risk-history', expertController.getPatientRiskHistory);
router.get('/patients/:patientId/chats', expertController.getPatientChats);

// ✅ NUEVAS RUTAS PARA MEJORAS DEL PANEL
router.patch('/patients/:patientId/status', expertController.togglePatientStatus);
router.get('/patients/:patientId/daily-report', expertController.getPatientDailyReport);
router.get('/patients-advanced', expertController.getMyPatientsAdvanced);

// ✅ NUEVAS RUTAS PARA ACTUALIZACIONES EN TIEMPO REAL
router.get('/patients/check-new', expertController.checkNewPatients);
router.get('/updates/real-time', expertController.getRealTimeUpdates);

router.get('/patients/:patientId/diagnose', expertController.diagnosePatientData);
router.post('/patients/:patientId/generate-sample-data', expertController.generateSampleData);
router.get('/patients/:patientId/chats-debug', expertController.getPatientChatsDebug);
router.post('/patients/:patientId/test-chat', expertController.createTestChat);
router.get('/patients/:patientId/debug-analysis', expertController.debugPatientAnalysis);

// Nueva ruta para estadísticas avanzadas
router.get('/dashboard/advanced-stats', expertController.getAdvancedDashboardStats);

// ✅ NUEVAS RUTAS PARA GRÁFICAS DE COLEGIO
router.get('/patients/by-grade', expertController.getPatientsByGrade);
router.get('/patients/by-section', expertController.getPatientsBySection);
router.get('/patients/debug-school-data', expertController.debugPatientData);

router.get('/dashboard/recent-activity', expertController.getRecentActivity);

// ✅ CORREGIDO: Esta línea estaba causando el error - auth no estaba definido
router.get('/institution-config', expertController.getInstitutionConfig); 

router.get('/filters/options', expertController.getFilterOptions);

module.exports = router; // ✅ Esto debe ser lo ÚNICO al final