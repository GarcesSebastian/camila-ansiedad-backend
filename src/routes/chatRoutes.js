// backend/src/routes/chatRoutes.js - VERSIÓN COMPLETA CORREGIDA SIN DUPLICADOS

const express = require('express');
const { 
    sendMessage, 
    getChats, 
    getChat, 
    deleteChat,
    getAnxietyMetrics,
    diagnoseChats,
    forceRepairDatabase
} = require('../controllers/chatController');
const { validateMessage } = require('../middleware/validation');
const { protect, anonymousAuth, checkAnonymousLimit } = require('../middleware/auth');

const router = express.Router();

// ==================== RUTAS PRINCIPALES ====================

// Enviar mensaje con soporte para anónimos
router.post('/message', anonymousAuth, checkAnonymousLimit, validateMessage, sendMessage);

// Obtener chats (soporta autenticados y anónimos)
router.get('/chats', (req, res, next) => {
    // Si hay token, usar protect
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        console.log('🔑 Usando autenticación protegida para /chats');
        return protect(req, res, next);
    } else {
        // Si no hay token, usar anonymousAuth
        console.log('👤 Usando autenticación anónima para /chats');
        return anonymousAuth(req, res, next);
    }
}, getChats);

// Obtener chat específico (solo autenticados) - ✅ USAR :id
router.get('/chats/:id', protect, getChat);

// Eliminar chat (solo autenticados) - ✅ USAR :id
router.delete('/chats/:id', protect, deleteChat);

// Obtener métricas de ansiedad (solo autenticados)
router.get('/metrics', protect, getAnxietyMetrics);

// ==================== RUTAS DE DIAGNÓSTICO Y REPARACIÓN ====================

// Diagnóstico de chats
router.get('/diagnose', protect, diagnoseChats);

// Reparación crítica de base de datos
router.post('/force-repair', protect, forceRepairDatabase);

// Diagnóstico con acciones
router.post('/diagnose', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const { action, user_id } = req.body;
        
        console.log('🔧 Acción solicitada:', action, 'para usuario:', userId);
        
        if (action === 'force_repair_database') {
            console.log('🚨 EJECUTANDO REPARACIÓN DE BASE DE DATOS...');
            
            // SOLUCIÓN 1: Forzar reconexión de MongoDB
            const db = require('mongoose').connection;
            console.log('📊 Estado de BD:', db.readyState === 1 ? 'Conectada' : 'Desconectada');
            
            // SOLUCIÓN 2: Buscar chats con consulta MÁS flexible
            const Chat = require('../models/Chat');
            const mongoose = require('mongoose');
            
            const flexibleQuery = {
                $or: [
                    { userId: userId },
                    { userId: userId.toString() },
                    { userId: new mongoose.Types.ObjectId(userId) }
                ]
            };
            
            console.log('🔍 Buscando con query flexible:', flexibleQuery);
            
            const chats = await Chat.find(flexibleQuery);
            console.log('📊 Chats encontrados con query flexible:', chats.length);
            
            // SOLUCIÓN 3: Actualizar todos los chats
            let updatedCount = 0;
            for (const chat of chats) {
                // Normalizar el userId y asegurar isAnonymous
                chat.userId = new mongoose.Types.ObjectId(userId);
                chat.isAnonymous = false;
                chat.updatedAt = new Date();
                await chat.save();
                updatedCount++;
                console.log(`✅ Chat ${chat._id} normalizado`);
            }
            
            return res.json({
                success: true,
                message: `Reparación completada. ${updatedCount} chats normalizados.`,
                repaired: updatedCount,
                foundWithFlexibleQuery: chats.length
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Diagnóstico completado' 
        });
        
    } catch (error) {
        console.error('Error en reparación:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error en reparación: ' + error.message 
        });
    }
});

// Actualizar chat individual
router.put('/chats/:id', protect, async (req, res) => {
    try {
        const chatId = req.params.id;
        const updateData = req.body;
        
        console.log('🔧 Actualizando chat:', chatId, 'con datos:', updateData);
        
        const Chat = require('../models/Chat');
        const mongoose = require('mongoose');
        
        const chat = await Chat.findOneAndUpdate(
            { 
                _id: chatId, 
                userId: req.user._id // Solo permitir actualizar chats del usuario
            },
            { 
                $set: updateData 
            },
            { 
                new: true,
                runValidators: true 
            }
        );
        
        if (!chat) {
            return res.status(404).json({
                success: false,
                message: 'Chat no encontrado o no autorizado'
            });
        }
        
        console.log('✅ Chat actualizado:', chat._id);
        
        res.json({
            success: true,
            data: {
                chat: {
                    _id: chat._id,
                    title: chat.title,
                    isAnonymous: chat.isAnonymous,
                    updatedAt: chat.updatedAt
                }
            }
        });
        
    } catch (error) {
        console.error('Error actualizando chat:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

module.exports = router;