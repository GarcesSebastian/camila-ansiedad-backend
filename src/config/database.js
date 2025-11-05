const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/camila-ansiedad', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`✅ MongoDB Conectado: ${conn.connection.host}`);
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error);
        process.exit(1);
    }
};

module.exports = connectDB;