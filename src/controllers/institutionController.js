const Institution = require('../models/Institution');
const Program = require('../models/Program');
const Faculty = require('../models/Faculty');
const Career = require('../models/Career');

const institutionController = {
    // Crear institución
    createInstitution: async (req, res) => {
        try {
            const institutionData = req.body;
            const institution = await Institution.create(institutionData);
            
            res.status(201).json({
                success: true,
                message: 'Institución creada exitosamente',
                data: { institution }
            });
        } catch (error) {
            console.error('Error creando institución:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener todas las instituciones
    getInstitutions: async (req, res) => {
        try {
            const institutions = await Institution.find({ isActive: true });
            
            res.json({
                success: true,
                data: { institutions }
            });
        } catch (error) {
            console.error('Error obteniendo instituciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener una institución específica (FUNCIÓN FALTANTE)
    getInstitution: async (req, res) => {
        try {
            const { id } = req.params;
            const institution = await Institution.findById(id);
            
            if (!institution) {
                return res.status(404).json({
                    success: false,
                    message: 'Institución no encontrada'
                });
            }
            
            res.json({
                success: true,
                data: { institution }
            });
        } catch (error) {
            console.error('Error obteniendo institución:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Actualizar institución (FUNCIÓN FALTANTE)
    updateInstitution: async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log('✏️ Actualizando institución:', id, updateData);

        // Verificar permisos
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para actualizar instituciones'
            });
        }

        // Buscar y actualizar institución
        const institution = await Institution.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!institution) {
            return res.status(404).json({
                success: false,
                message: 'Institución no encontrada'
            });
        }

        console.log('✅ Institución actualizada:', institution.name);

        res.json({
            success: true,
            message: 'Institución actualizada exitosamente',
            data: { institution }
        });

    } catch (error) {
        console.error('❌ Error actualizando institución:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar la institución: ' + error.message
        });
    }
},

deleteInstitution: async (req, res) => {
    try {
        const { id } = req.params;

        console.log('🗑️ Eliminando institución:', id);

        // Verificar permisos
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para eliminar instituciones'
            });
        }

        // Verificar si la institución existe
        const institution = await Institution.findById(id);
        if (!institution) {
            return res.status(404).json({
                success: false,
                message: 'Institución no encontrada'
            });
        }

        // Verificar si hay usuarios asociados
        const User = require('../models/User'); // 🔥 IMPORTAR User aquí
        const usersCount = await User.countDocuments({ 
            institution: id, 
            isActive: true 
        });
        
        if (usersCount > 0) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar la institución porque tiene ${usersCount} usuario(s) asociado(s)`
            });
        }

        // Soft delete - marcar como inactiva
        institution.isActive = false;
        await institution.save();

        console.log('✅ Institución marcada como inactiva:', institution.name);

        res.json({
            success: true,
            message: 'Institución eliminada exitosamente'
        });

    } catch (error) {
        console.error('❌ Error eliminando institución:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar la institución: ' + error.message
        });
    }
},

    // Obtener estructura de una institución
    getInstitutionStructure: async (req, res) => {
        try {
            const { id } = req.params;
            
            const institution = await Institution.findById(id);
            const programs = await Program.find({ institution: id });
            const faculties = await Faculty.find({ institution: id });
            const careers = await Career.find({ institution: id });
            
            res.json({
                success: true,
                data: {
                    institution,
                    programs,
                    faculties,
                    careers
                }
            });
        } catch (error) {
            console.error('Error obteniendo estructura institucional:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Crear programa
    createProgram: async (req, res) => {
        try {
            const programData = req.body;
            const program = await Program.create(programData);
            
            res.status(201).json({
                success: true,
                message: 'Programa creado exitosamente',
                data: { program }
            });
        } catch (error) {
            console.error('Error creando programa:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener programas
    getPrograms: async (req, res) => {
        try {
            const { institutionId } = req.query;
            const filter = institutionId ? { institution: institutionId } : {};
            
            const programs = await Program.find(filter);
            
            res.json({
                success: true,
                data: { programs }
            });
        } catch (error) {
            console.error('Error obteniendo programas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Crear facultad
    createFaculty: async (req, res) => {
        try {
            const facultyData = req.body;
            const faculty = await Faculty.create(facultyData);
            
            res.status(201).json({
                success: true,
                message: 'Facultad creada exitosamente',
                data: { faculty }
            });
        } catch (error) {
            console.error('Error creando facultad:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener facultades
    getFaculties: async (req, res) => {
        try {
            const { institutionId } = req.query;
            const filter = institutionId ? { institution: institutionId } : {};
            
            const faculties = await Faculty.find(filter);
            
            res.json({
                success: true,
                data: { faculties }
            });
        } catch (error) {
            console.error('Error obteniendo facultades:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Crear carrera
    createCareer: async (req, res) => {
        try {
            const careerData = req.body;
            const career = await Career.create(careerData);
            
            res.status(201).json({
                success: true,
                message: 'Carrera creada exitosamente',
                data: { career }
            });
        } catch (error) {
            console.error('Error creando carrera:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener carreras
    getCareers: async (req, res) => {
        try {
            const { institutionId } = req.query;
            const filter = institutionId ? { institution: institutionId } : {};
            
            const careers = await Career.find(filter);
            
            res.json({
                success: true,
                data: { careers }
            });
        } catch (error) {
            console.error('Error obteniendo carreras:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
};

module.exports = institutionController;