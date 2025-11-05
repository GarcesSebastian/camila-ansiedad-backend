// backend/src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect); // Primero proteger todas las rutas

// Gestión de expertos - Solo superadmin
router.get('/experts', authorize('superadmin', 'institutional_admin'), adminController.getExperts);
router.post('/experts', authorize('superadmin', 'institutional_admin'), adminController.createExpert);
// 🔥 AGREGAR ESTAS RUTAS NUEVAS:
router.put('/experts/:id', authorize('superadmin', 'institutional_admin'), adminController.updateExpert);
router.delete('/experts/:id', authorize('superadmin', 'institutional_admin'), adminController.deleteExpert);

// Gestión de usuarios - Múltiples roles permitidos
router.get('/users', authorize('superadmin', 'institutional_admin', 'expert'), adminController.getUsersByInstitution);
router.get('/users/:userId/analysis', authorize('superadmin', 'institutional_admin', 'expert'), adminController.getUserAnalysis);

// Gestión de pacientes (para expertos)
router.post('/patients', authorize('expert'), adminController.createPatient);
router.get('/patients', authorize('expert'), adminController.getMyPatients);

// Recomendaciones - Múltiples roles permitidos
router.post('/recommendations', authorize('superadmin', 'institutional_admin', 'expert'), adminController.addRecommendation);

// Reportes - Múltiples roles permitidos
router.get('/reports/institutional', authorize('superadmin', 'institutional_admin', 'expert'), adminController.generateInstitutionalReport);

// Estadísticas de super admin
router.get('/super-admin/stats', authorize('superadmin'), adminController.getSuperAdminStats);

module.exports = router;