// backend/src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Controlador temporal para las notificaciones
const userController = {
    // Obtener recomendaciones del usuario autenticado
    getMyRecommendations: async (req, res) => {
        try {
            const { status, priority, page = 1, limit = 10 } = req.query;
            const skip = (page - 1) * limit;

            // Simular datos de recomendaciones (en producción esto vendría de la base de datos)
            const mockRecommendations = [
                {
                    _id: '1',
                    expertId: {
                        _id: 'exp1',
                        name: 'Dra. María González',
                        expertProfile: {
                            specialization: 'Psicología Clínica'
                        }
                    },
                    recommendation: 'Te recomiendo practicar ejercicios de respiración profunda durante 5 minutos cada mañana. Esto te ayudará a manejar mejor los momentos de ansiedad.',
                    priority: 'high',
                    status: 'pending',
                    actions: [
                        {
                            description: 'Practicar respiración profunda 5 min/día',
                            completed: false,
                            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                        },
                        {
                            description: 'Llevar un diario de emociones',
                            completed: false,
                            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                        }
                    ],
                    createdAt: new Date('2024-01-15'),
                    updatedAt: new Date('2024-01-15')
                },
                {
                    _id: '2',
                    expertId: {
                        _id: 'exp1',
                        name: 'Dra. María González',
                        expertProfile: {
                            specialization: 'Psicología Clínica'
                        }
                    },
                    recommendation: 'Considera reducir el consumo de cafeína después de las 3 PM para mejorar la calidad de tu sueño.',
                    priority: 'medium',
                    status: 'in_progress',
                    actions: [
                        {
                            description: 'Limitar café a 2 tazas antes de las 3 PM',
                            completed: true,
                            completedAt: new Date('2024-01-16')
                        }
                    ],
                    createdAt: new Date('2024-01-10'),
                    updatedAt: new Date('2024-01-16')
                },
                {
                    _id: '3',
                    expertId: {
                        _id: 'exp2',
                        name: 'Dr. Carlos Rodríguez',
                        expertProfile: {
                            specialization: 'Terapia Cognitivo-Conductual'
                        }
                    },
                    recommendation: 'Excelente progreso en las técnicas de relajación. Continúa con la práctica diaria de mindfulness.',
                    priority: 'low',
                    status: 'completed',
                    actions: [
                        {
                            description: 'Practicar mindfulness 10 min/día',
                            completed: true,
                            completedAt: new Date('2024-01-14')
                        }
                    ],
                    createdAt: new Date('2024-01-05'),
                    updatedAt: new Date('2024-01-14')
                }
            ];

            // Filtrar recomendaciones según los parámetros
            let filteredRecommendations = mockRecommendations;

            if (status) {
                filteredRecommendations = filteredRecommendations.filter(rec => rec.status === status);
            }

            if (priority) {
                filteredRecommendations = filteredRecommendations.filter(rec => rec.priority === priority);
            }

            // Paginación simulada
            const startIndex = skip;
            const endIndex = startIndex + parseInt(limit);
            const paginatedRecommendations = filteredRecommendations.slice(startIndex, endIndex);

            res.json({
                success: true,
                data: {
                    recommendations: paginatedRecommendations,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: filteredRecommendations.length,
                        pages: Math.ceil(filteredRecommendations.length / limit)
                    }
                }
            });

        } catch (error) {
            console.error('Error obteniendo recomendaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener las recomendaciones'
            });
        }
    },

    // Actualizar estado de una recomendación
    updateRecommendationStatus: async (req, res) => {
        try {
            const { recommendationId } = req.params;
            const { status } = req.body;

            // Simular actualización (en producción esto actualizaría la base de datos)
            console.log(`Actualizando recomendación ${recommendationId} a estado: ${status}`);

            // Simular éxito
            res.json({
                success: true,
                message: 'Estado actualizado correctamente',
                data: {
                    recommendation: {
                        _id: recommendationId,
                        status: status,
                        updatedAt: new Date()
                    }
                }
            });

        } catch (error) {
            console.error('Error actualizando recomendación:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar la recomendación'
            });
        }
    },

    // Obtener estadísticas de recomendaciones
    getRecommendationStats: async (req, res) => {
        try {
            // Simular estadísticas
            const stats = {
                total: 3,
                highPriority: 1,
                byStatus: {
                    pending: 1,
                    in_progress: 1,
                    completed: 1
                }
            };

            res.json({
                success: true,
                data: {
                    stats: stats
                }
            });

        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas'
            });
        }
    }
};

// Rutas para que usuarios vean sus recomendaciones
router.get('/recommendations', protect, userController.getMyRecommendations);
router.get('/recommendations/stats', protect, userController.getRecommendationStats);
router.put('/recommendations/:recommendationId/status', protect, userController.updateRecommendationStatus);

module.exports = router;