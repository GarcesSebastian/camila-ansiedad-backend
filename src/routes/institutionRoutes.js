// backend/src/routes/institutionRoutes.js
const express = require('express');
const router = express.Router();
const institutionController = require('../controllers/institutionController');
const { protect, authorize } = require('../middleware/auth');

// 🔥 CORRECCIÓN: Middleware de autenticación aplicado correctamente
router.use(protect); // Primero proteger todas las rutas

// 🔥 RUTAS PARA INSTITUCIONES

// Crear institución - Solo superadmin
router.post('/institutions', authorize('superadmin'), institutionController.createInstitution);

// Obtener instituciones - Múltiples roles
router.get('/institutions', authorize('superadmin', 'institutional_admin', 'expert'), institutionController.getInstitutions);

// Obtener institución específica - Múltiples roles
router.get('/institutions/:id', authorize('superadmin', 'institutional_admin', 'expert'), institutionController.getInstitution);

// Actualizar institución - Solo superadmin
router.put('/institutions/:id', authorize('superadmin'), institutionController.updateInstitution);

// 🔥 AGREGAR RUTA PARA ELIMINAR INSTITUCIÓN
router.delete('/institutions/:id', authorize('superadmin'), institutionController.deleteInstitution);

// Obtener estructura institucional - Múltiples roles
router.get('/institutions/:id/structure', authorize('superadmin', 'institutional_admin', 'expert'), institutionController.getInstitutionStructure);

// 🔥 RUTAS PARA PROGRAMAS

// Crear programa - Superadmin y admin institucional
router.post('/programs', authorize('superadmin', 'institutional_admin'), institutionController.createProgram);

// Obtener programas - Múltiples roles
router.get('/programs', authorize('superadmin', 'institutional_admin', 'expert'), institutionController.getPrograms);

// 🔥 RUTAS PARA FACULTADES

// Crear facultad - Superadmin y admin institucional
router.post('/faculties', authorize('superadmin', 'institutional_admin'), institutionController.createFaculty);

// Obtener facultades - Múltiples roles
router.get('/faculties', authorize('superadmin', 'institutional_admin', 'expert'), institutionController.getFaculties);

// 🔥 RUTAS PARA CARRERAS

// Crear carrera - Superadmin y admin institucional
router.post('/careers', authorize('superadmin', 'institutional_admin'), institutionController.createCareer);

// Obtener carreras - Múltiples roles
router.get('/careers', authorize('superadmin', 'institutional_admin', 'expert'), institutionController.getCareers);

module.exports = router;