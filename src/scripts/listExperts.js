const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Configurar variables de entorno manualmente
const loadEnvFile = () => {
    const envPath = path.join(__dirname, '..', '..', '.env');
    
    if (fs.existsSync(envPath)) {
        console.log('📁 Cargando variables de .env:', envPath);
        const envFile = fs.readFileSync(envPath, 'utf8');
        const envVars = envFile.split('\n')
            .filter(line => line && !line.startsWith('#'))
            .reduce((acc, line) => {
                const equalsIndex = line.indexOf('=');
                if (equalsIndex !== -1) {
                    const key = line.substring(0, equalsIndex).trim();
                    const value = line.substring(equalsIndex + 1).trim();
                    // Remover comillas si existen
                    const cleanValue = value.replace(/^['"](.*)['"]$/, '$1');
                    if (key && cleanValue) {
                        acc[key] = cleanValue;
                    }
                }
                return acc;
            }, {});
        
        // Establecer variables de entorno
        Object.keys(envVars).forEach(key => {
            process.env[key] = envVars[key];
        });
        
        return true;
    } else {
        console.log('❌ No se encontró archivo .env en:', envPath);
        return false;
    }
};

// Registrar todos los modelos manualmente
const registerModels = () => {
    console.log('📝 Registrando modelos...');
    
    // Modelo Institution
    const institutionSchema = new mongoose.Schema({
        name: { type: String, required: true },
        type: { 
            type: String, 
            enum: ['university', 'school', 'company', 'health_center', 'other'],
            required: true 
        },
        address: String,
        contactEmail: String,
        phone: String,
        isActive: { type: Boolean, default: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }, { timestamps: true });

    // Modelo User
    const userSchema = new mongoose.Schema({
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        role: { 
            type: String, 
            enum: ['superadmin', 'institutional_admin', 'expert', 'user'],
            default: 'user'
        },
        institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution' },
        isActive: { type: Boolean, default: true },
        
        // Perfil de experto
        expertProfile: {
            specialization: String,
            licenseNumber: String,
            yearsOfExperience: Number,
            assignedPrograms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Program' }],
            assignedFaculties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' }],
            assignedCareers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Career' }],
            currentPatients: { type: Number, default: 0 },
            maxPatients: { type: Number, default: 50 }
        },
        
        // Perfil de paciente
        patientProfile: {
            assignedExpert: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            status: { type: String, enum: ['active', 'inactive', 'discharged'], default: 'active' },
            riskLevel: { type: String, enum: ['minimo', 'bajo', 'medio', 'alto', 'critico'] },
            lastRiskAssessment: {
                riskLevel: String,
                riskScore: Number,
                assessedAt: Date,
                keywordsDetected: Number
            },
            medicalHistory: String,
            emergencyContact: String,
            lastEvaluation: Date
        },
        
        // Ruta institucional
        institutionalPath: {
            program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
            faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
            career: { type: mongoose.Schema.Types.ObjectId, ref: 'Career' },
            semester: String,
            course: String,
            grade: String,
            section: String,
            schedule: String,
            department: String,
            position: String
        },
        
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }, { timestamps: true });

    // Registrar modelos si no existen
    if (!mongoose.models.Institution) {
        mongoose.model('Institution', institutionSchema);
    }
    
    if (!mongoose.models.User) {
        mongoose.model('User', userSchema);
    }
    
    console.log('✅ Modelos registrados correctamente');
};

const listExperts = async () => {
    try {
        console.log('🚀 Iniciando listado de expertos...');
        
        // Cargar variables de entorno
        if (!loadEnvFile()) {
            console.log('⚠️  Intentando usar variables de entorno del sistema...');
        }
        
        // Verificar que tenemos MONGODB_URI
        const MONGODB_URI = process.env.MONGODB_URI;
        
        if (!MONGODB_URI) {
            console.log('❌ No se encontró MONGODB_URI en las variables de entorno');
            return;
        }
        
        console.log('🔗 Conectando a MongoDB...');
        console.log('📊 URI encontrada (ocultando credenciales)...');
        
        // Mostrar URI sin credenciales
        const safeUri = MONGODB_URI.replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://***:***@');
        console.log('📊 URI segura:', safeUri);
        
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        
        console.log('✅ Conectado a MongoDB exitosamente');
        
        // Registrar modelos antes de usarlos
        registerModels();
        
        const User = mongoose.model('User');
        
        // Buscar todos los usuarios con rol de experto
        const experts = await User.find({ 
            role: 'expert',
            isActive: true 
        })
        .select('_id name email institution expertProfile createdAt')
        .populate('institution', 'name type')
        .sort({ createdAt: -1 });
        
        console.log('\n👥 EXPERTOS ENCONTRADOS:');
        console.log('========================');
        
        if (experts.length === 0) {
            console.log('❌ No se encontraron expertos en la base de datos');
            
            // Verificar si hay usuarios en general
            const totalUsers = await User.countDocuments();
            console.log(`📊 Total usuarios en la base de datos: ${totalUsers}`);
            
            const usersByRole = await User.aggregate([
                { $group: { _id: '$role', count: { $sum: 1 } } }
            ]);
            
            console.log('📈 Distribución por roles:');
            usersByRole.forEach(role => {
                console.log(`   - ${role._id}: ${role.count}`);
            });
            
        } else {
            experts.forEach((expert, index) => {
                console.log(`\n${index + 1}. ${expert.name}`);
                console.log(`   ID: ${expert._id}`);
                console.log(`   Email: ${expert.email}`);
                console.log(`   Institución: ${expert.institution?.name || 'No asignada'} (${expert.institution?.type || 'N/A'})`);
                console.log(`   ID Institución: ${expert.institution?._id || 'N/A'}`);
                console.log(`   Pacientes asignados: ${expert.expertProfile?.currentPatients || 0}`);
                console.log(`   Fecha creación: ${expert.createdAt.toLocaleDateString()}`);
            });
            
            console.log(`\n📊 Total: ${experts.length} experto(s)`);
        }
        
        await mongoose.disconnect();
        console.log('\n✅ Listado completado');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('🔍 Stack:', error.stack);
        
        process.exit(1);
    }
};

// Ejecutar solo si es el archivo principal
if (require.main === module) {
    listExperts();
}

module.exports = listExperts;