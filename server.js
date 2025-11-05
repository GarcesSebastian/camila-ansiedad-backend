require('dotenv').config();

// Verificar variables de entorno críticas
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'DEEPSEEK_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Variables de entorno faltantes:', missingEnvVars);
  process.exit(1);
}

// 🔥 IMPORTAR LA APP CONFIGURADA - ESTO ES LO QUE FALTABA
const app = require('./src/app');

const PORT = process.env.PORT || 5001;

// Función para encontrar puerto disponible
function findAvailablePort(port) {
  return new Promise((resolve, reject) => {
    const server = require('net').createServer();
    
    server.listen(port, () => {
      server.close(() => resolve(port));
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️  Puerto ${port} en uso, probando ${port + 1}...`);
        resolve(findAvailablePort(port + 1));
      } else {
        reject(err);
      }
    });
  });
}

// Iniciar servidor
async function startServer() {
  try {
    const availablePort = await findAvailablePort(PORT);
    
    const server = app.listen(availablePort, '0.0.0.0', () => {
      console.log(`🚀 Servidor Camila ejecutándose en puerto ${availablePort}`);
      console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${availablePort}/api/health`);
      console.log(`🌐 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`🗄️  Database: ${process.env.MONGODB_URI ? 'MongoDB Atlas' : 'Local'}`);
      
      // ⬇️⬇️⬇️ COMENTA ESTA SECCIÓN COMPLETA ⬇️⬇️⬇️
      // Mostrar rutas disponibles
      // console.log('🛣️  Rutas disponibles:');
      // console.log('   📍 GET  /api/health');
      // console.log('   📍 GET  /api/info');
      // console.log('   📍 GET  /api/status');
      // console.log('   📍 AUTH /api/auth/*');
      // console.log('   📍 CHAT /api/chat/*');
      // console.log('   📍 ADMIN /api/admin/*');
      // console.log('   📍 INSTITUTION /api/institution/*');
      // console.log('   📍 EXPERT /api/expert/*');
      // console.log('   📍 USERS /api/users/*');
      // ⬆️⬆️⬆️ FIN DE SECCIÓN A COMENTAR ⬆️⬆️⬆️
    });

    return server;
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Iniciar la aplicación
const server = startServer();

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM recibido - Cerrando servidor gracefully...');
  server.then(s => s.close(() => {
    console.log('💤 Proceso terminado');
    process.exit(0);
  }));
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT recibido - Cerrando servidor gracefully...');
  server.then(s => s.close(() => {
    console.log('💤 Proceso terminado');
    process.exit(0);
  }));
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  server.then(s => s.close(() => {
    process.exit(1);
  }));
});

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  server.then(s => s.close(() => {
    process.exit(1);
  }));
});