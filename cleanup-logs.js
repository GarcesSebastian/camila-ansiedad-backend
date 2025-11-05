const fs = require('fs');
const path = require('path');

// Archivos específicos a limpiar
const filesToClean = [
    'src/app.js',
    'src/controllers/adminController.js',
    'src/controllers/chatController.js',
    'src/controllers/expertController.js',
    'src/controllers/institutionController.js',
    'src/middleware/auth.js',
    'src/models/User.js',
    'src/routes/authRoutes.js',
    'src/routes/chatRoutes.js',
    'src/services/realTimeAnalysisService.js',
    'src/services/riskAnalysisService.js'
];

// Patrones de console.log a eliminar (emojis comunes)
const emojiPatterns = [
    /console\.log\([^)]*[🔄✅❌👤🔐🔍📝🚀🔥📊🎯⚡💾🔧🎨✨🏛️👥🗑️🎉💬🎯📅📋📈🏢📚👥🔤🔴🟢🔍💾🎯🚨💭🔧📁🔗📊👥📝📅🔤💬📊🔍📈💾🔤📝🔍📊🎯📈💾🔤📝🔍📊🎯📈💾][^)]*\);?\n?/g,
    /console\.log\([^)]*BACKEND[^)]*\)/gi,
    /console\.log\([^)]*DEBUG[^)]*\)/gi
];

function cleanFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`Archivo no encontrado: ${filePath}`);
            return false;
        }

        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        let changes = 0;

        // Eliminar console.logs con emojis
        emojiPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                changes += matches.length;
                content = content.replace(pattern, '');
            }
        });

        // Limpiar líneas vacías múltiples
        content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

        if (changes > 0) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Limpiado ${filePath}: ${changes} console.logs eliminados`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.log(`❌ Error limpiando ${filePath}:`, error.message);
        return false;
    }
}

// Ejecutar limpieza
console.log('🧹 Iniciando limpieza de console.logs de debug...\n');

let totalCleaned = 0;
filesToClean.forEach(file => {
    if (cleanFile(file)) {
        totalCleaned++;
    }
});

console.log(`\n🎉 Limpieza completada: ${totalCleaned} archivos modificados`);