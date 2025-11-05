const fs = require('fs');
const path = require('path');

// Archivos restantes a limpiar
const remainingFiles = [
    'src/config/database.js',
    'src/controllers/authController.js',
    'src/app.js' // Para limpiar esa línea específica
];

// Función para limpiar archivos específicos
function cleanRemainingFiles() {
    console.log('🧹 Limpiando archivos restantes...\n');

    // Limpiar database.js
    try {
        let dbContent = fs.readFileSync('src/config/database.js', 'utf8');
        dbContent = dbContent.replace(/console\.log\(`✅ MongoDB Conectado: \$\{conn\.connection\.host\}`\);/, '');
        fs.writeFileSync('src/config/database.js', dbContent, 'utf8');
        console.log('✅ database.js limpiado');
    } catch (error) {
        console.log('❌ Error limpiando database.js:', error.message);
    }

    // Limpiar authController.js
    try {
        let authContent = fs.readFileSync('src/controllers/authController.js', 'utf8');
        authContent = authContent.replace(/console\.log\(`✅ Usuario \$\{user\.email\} actualizado con acceptedTerms: true`\);/, '');
        fs.writeFileSync('src/controllers/authController.js', authContent, 'utf8');
        console.log('✅ authController.js limpiado');
    } catch (error) {
        console.log('❌ Error limpiando authController.js:', error.message);
    }

    // Limpiar línea específica de app.js
    try {
        let appContent = fs.readFileSync('src/app.js', 'utf8');
        appContent = appContent.replace(/console\.log\('   GET    \\\/api\\\/auth\\\/terms'\); \/\/ ✅ NUEVA RUTA AGREGADA/, '');
        fs.writeFileSync('src/app.js', appContent, 'utf8');
        console.log('✅ app.js limpiado');
    } catch (error) {
        console.log('❌ Error limpiando app.js:', error.message);
    }

    console.log('\n🎉 Limpieza de archivos restantes completada');
}

cleanRemainingFiles();