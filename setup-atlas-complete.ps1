# Configuración completa de MongoDB Atlas
Write-Host "🚀 CONFIGURACIÓN COMPLETA MONGODB ATLAS" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Paso 1: Verificar estructura
Write-Host "`n1. VERIFICANDO ESTRUCTURA..." -ForegroundColor Cyan
if (-not (Test-Path "backend") -or -not (Test-Path "frontend")) {
    Write-Host "❌ Estructura de proyecto incorrecta" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Estructura correcta" -ForegroundColor Green

# Paso 2: Verificar .env
Write-Host "`n2. VERIFICANDO CONFIGURACIÓN..." -ForegroundColor Cyan
if (-not (Test-Path "backend\.env")) {
    Write-Host "❌ No se encuentra backend/.env" -ForegroundColor Red
    Write-Host "   Creando archivo .env de ejemplo..." -ForegroundColor Yellow
    
    @"
# MongoDB Atlas
MONGODB_URI=mongodb+srv://camilaansiedad2025_db_user:bL57cTesEbE9kfjr@camila-cluster.rf1w8xz.mongodb.net/camila-ansiedad?retryWrites=true&w=majority&appName=camila-cluster

# API Key de DeepSeek
DEEPSEEK_API_KEY=sk-8288ec039c4f46b0b35efb7002f1f0f9

# JWT Secret
JWT_SECRET=tu_jwt_secret_super_seguro_aqui_cambialo_en_produccion_2024
JWT_EXPIRES_IN=24h

# Frontend URL
FRONTEND_URL=http://localhost:3000
"@ | Out-File -FilePath "backend\.env" -Encoding UTF8

    Write-Host "✅ Archivo .env creado. Por favor verifica las credenciales." -ForegroundColor Green
}

# Paso 3: Instalar dependencias
Write-Host "`n3. INSTALANDO DEPENDENCIAS..." -ForegroundColor Cyan
Set-Location backend

if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Instalando dependencias del backend..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error instalando dependencias" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    Write-Host "✅ Dependencias instaladas" -ForegroundColor Green
} else {
    Write-Host "✅ Dependencias ya instaladas" -ForegroundColor Green
}

# Paso 4: Crear scripts de configuración si no existen
Write-Host "`n4. CONFIGURANDO SCRIPTS..." -ForegroundColor Cyan

if (-not (Test-Path "scripts")) {
    New-Item -ItemType Directory -Path "scripts" -Force
}

# Crear script de test de conexión
@"
const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
    console.log('🔗 Conectando a MongoDB Atlas...');
    console.log('📊 Usando:', process.env.MONGODB_URI.replace(/:[^:]*@/, ':********@'));
    
    try {
        const startTime = Date.now();
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 15000
        });
        
        const endTime = Date.now();
        
        console.log('✅ CONEXIÓN EXITOSA!');
        console.log('🏠 Host:', mongoose.connection.host);
        console.log('📊 Base de datos:', mongoose.connection.db.databaseName);
        console.log('⏱️  Tiempo de conexión:', (endTime - startTime) + 'ms');
        console.log('🔌 Estado:', mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado');
        
        // Probar operaciones básicas
        console.log('\n🧪 Probando operaciones...');
        
        // Crear colección de test
        const testDoc = { 
            test: 'Conexión exitosa', 
            timestamp: new Date(),
            project: 'Camila Ansiedad Detector'
        };
        
        const result = await mongoose.connection.db.collection('connection_tests').insertOne(testDoc);
        console.log('✅ Escritura exitosa - ID:', result.insertedId);
        
        // Leer el documento
        const found = await mongoose.connection.db.collection('connection_tests').findOne({_id: result.insertedId});
        console.log('✅ Lectura exitosa - Test:', found.test);
        
        // Limpiar
        await mongoose.connection.db.collection('connection_tests').deleteOne({_id: result.insertedId});
        console.log('✅ Limpieza exitosa');
        
        console.log('\n🎉 ¡Todas las pruebas pasaron! MongoDB Atlas está listo.');
        
    } catch (error) {
        console.log('❌ ERROR DE CONEXIÓN:');
        console.log('   - Mensaje:', error.message);
        
        if (error.message.includes('authentication')) {
            console.log('\n🔧 PROBLEMA: Autenticación falló');
            console.log('   Verifica:');
            console.log('   1. Usuario: camilaansiedad2025_db_user');
            console.log('   2. Contraseña en .env');
            console.log('   3. Que el usuario tenga permisos readWrite');
        } else if (error.message.includes('getaddrinfo')) {
            console.log('\n🔧 PROBLEMA: No se puede conectar al cluster');
            console.log('   Verifica:');
            console.log('   1. Nombre del cluster: camila-cluster.rf1w8xz.mongodb.net');
            console.log('   2. Tu conexión a internet');
            console.log('   3. Whitelist de IPs en MongoDB Atlas');
        }
        
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

testConnection();
"@ | Out-File -FilePath "scripts\test-connection.js" -Encoding UTF8

Write-Host "✅ Scripts de configuración creados" -ForegroundColor Green

# Paso 5: Probar conexión
Write-Host "`n5. PROBANDO CONEXIÓN A MONGODB ATLAS..." -ForegroundColor Cyan
node scripts/test-connection.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n🎉 ¡CONFIGURACIÓN COMPLETADA EXITOSAMENTE!" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Green
    
    Write-Host "`n📝 PRÓXIMOS PASOS:" -ForegroundColor Yellow
    Write-Host "1. Iniciar backend: cd backend && npm run dev" -ForegroundColor White
    Write-Host "2. Iniciar frontend: cd frontend && npm run dev" -ForegroundColor White
    Write-Host "3. Abrir: http://localhost:3000" -ForegroundColor White
    
    Write-Host "`n🔍 MONITOREO:" -ForegroundColor Cyan
    Write-Host "   - Ve a https://cloud.mongodb.com" -ForegroundColor White
    Write-Host "   - Revisa tu cluster 'camila-cluster'" -ForegroundColor White
    Write-Host "   - Verifica las colecciones creadas" -ForegroundColor White
} else {
    Write-Host "`n❌ La configuración encontró problemas." -ForegroundColor Red
    Write-Host "   Revisa las credenciales en backend/.env" -ForegroundColor Yellow
}

Set-Location ..