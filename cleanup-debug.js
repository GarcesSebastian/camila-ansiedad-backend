const fs = require('fs');
const path = require('path');

// Patrones de console.log a eliminar
const debugPatterns = [
    /console\.log\([^)]*[🔄✅❌👤🔐🔍📝🚀🔥📊🎯⚡💾🔧🎨✨][^)]*\)/g,
    /console\.log\([^)]*BORRAR[^)]*\)/gi,
    /console\.log\([^)]*ELIMINAR[^)]*\)/gi,
    /console\.log\([^)]*DEBUG[^)]*\)/gi,
    /console\.log\([^)]*TEST[^)]*\)/gi
];

// Archivos a limpiar (excluyendo node_modules)
const filesToClean = [
    'src/controllers',
    'src/models', 
    'src/middleware',
    'src/routes',
    'src/services',
    'src/scripts'
];

function cleanFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        
        // Eliminar console.logs de debug
        debugPatterns.forEach(pattern => {
            content = content.replace(pattern, '');
        });
        
        // Eliminar líneas vacías múltiples
        content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Limpiado: ${filePath}`);
            return true;
        }
        return false;
    } catch (error) {
        console.log(`❌ Error limpiando ${filePath}:`, error.message);
        return false;
    }
}

function cleanDirectory(directory) {
    if (!fs.existsSync(directory)) return;
    
    const items = fs.readdirSync(directory);
    let cleanedCount = 0;
    
    items.forEach(item => {
        const fullPath = path.join(directory, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.includes('node_modules')) {
            cleanedCount += cleanDirectory(fullPath);
        } else if (stat.isFile() && item.endsWith('.js')) {
            if (cleanFile(fullPath)) cleanedCount++;
        }
    });
    
    return cleanedCount;
}

// Ejecutar limpieza
console.log('🧹 Iniciando limpieza de código debug...\n');

let totalCleaned = 0;
filesToClean.forEach(dir => {
    if (fs.existsSync(dir)) {
        console.log(`📁 Limpiando: ${dir}`);
        totalCleaned += cleanDirectory(dir);
    }
});

console.log(`\n🎉 Limpieza completada: ${totalCleaned} archivos modificados`);