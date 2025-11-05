require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function testExpert() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado a MongoDB');

        // Verificar si ya existe
        const existing = await User.findOne({ email: 'testexpert@test.com' });
        if (existing) {
            console.log('✅ Usuario test ya existe');
            console.log(existing);
        } else {
            // Crear usuario de prueba
            const testExpert = new User({
                name: 'Test Expert',
                email: 'testexpert@test.com',
                password: 'test123',
                role: 'expert',
                expertProfile: {
                    specialization: 'Psicología Clínica',
                    yearsOfExperience: 5
                }
            });

            await testExpert.save();
            console.log('✅ Usuario test creado:', testExpert._id);
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testExpert();