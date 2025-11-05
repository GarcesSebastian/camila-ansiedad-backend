const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// Intentar cargar .env desde múltiples ubicaciones posibles
const envPaths = [
    path.resolve(__dirname, '../../../.env'), // Raíz del proyecto
    path.resolve(__dirname, '../../../../.env'), // Escritorio (ubicación actual)
    path.resolve(__dirname, '../../.env'), // Backend
];

let envLoaded = false;
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        console.log(`✅ .env cargado desde: ${envPath}`);
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    console.log('⚠️ No se encontró archivo .env, usando URI directa');
}

const createSuperAdmin = async () => {
    try {
        console.log('🔌 Conectando a MongoDB...');
        
        // Usar MONGODB_URI del .env o URI directa como fallback
        const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://camilaansiedad2025_db_user:bL57cTesEbE9kfjr@camila-cluster.rf1w8xz.mongodb.net/camila-ansiedad?retryWrites=true&w=majority&appName=camila-cluster';
        
        console.log('📡 Usando:', mongoURI.substring(0, 60) + '...');
        
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
        });
        
        console.log('✅ Conectado a MongoDB Atlas exitosamente');
        
        // Verificar y crear superadmin
        const superAdmin = await User.findOne({ role: 'superadmin' });
        
        if (!superAdmin) {
            const adminUser = new User({
                name: 'Super Administrador',
                email: 'superadmin@camila.com',
                password: 'admin123',
                role: 'superadmin',
                isActive: true,
                emailVerified: true
            });
            
            await adminUser.save();
            console.log('✅ Super administrador creado exitosamente');
            console.log('📧 Email: superadmin@camila.com');
            console.log('🔑 Contraseña: admin123');
            console.log('👤 Rol: superadmin');
            console.log('\n⚠️ IMPORTANTE: Cambia la contraseña después del primer login!');
        } else {
            console.log('✅ Super administrador ya existe en el sistema');
            console.log(`📧 Email: ${superAdmin.email}`);
            console.log(`👤 Nombre: ${superAdmin.name}`);
        }
        
        await mongoose.disconnect();
        console.log('🔌 Conexión cerrada');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.name === 'MongooseServerSelectionError') {
            console.log('💡 Problema de conexión:');
            console.log('   • Verifica tu conexión a internet');
            console.log('   • Revisa la whitelist de IPs en MongoDB Atlas');
        }
        
        process.exit(1);
    }
};

createSuperAdmin();