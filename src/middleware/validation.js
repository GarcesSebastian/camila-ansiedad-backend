const validator = require('validator');

const validateRegister = (req, res, next) => {
    const { email, password, name, age, acceptedTerms } = req.body;
    const errors = [];

    // Validar email
    if (!email || !validator.isEmail(email)) {
        errors.push('Por favor proporciona un email válido');
    }

    // Validar contraseña
    if (!password || password.length < 6) {
        errors.push('La contraseña debe tener al menos 6 caracteres');
    }

    // Validar nombre
    if (!name || name.trim().length < 2) {
        errors.push('El nombre debe tener al menos 2 caracteres');
    }

    // ✅ VALIDAR TÉRMINOS Y CONDICIONES
    if (!acceptedTerms) {
        errors.push('Debes aceptar los términos y condiciones');
    }

    // Validar edad (opcional)
    if (age && (age < 13 || age > 120)) {
        errors.push('La edad debe estar entre 13 y 120 años');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Datos de entrada inválidos',
            errors
        });
    }

    next();
};

const validateMessage = (req, res, next) => {
    const { message } = req.body;
    const errors = [];

    if (!message || message.trim().length === 0) {
        errors.push('El mensaje no puede estar vacío');
    }

    if (message && message.length > 2000) {
        errors.push('El mensaje no puede tener más de 2000 caracteres');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Mensaje inválido',
            errors
        });
    }

    next();
};

module.exports = { validateRegister, validateMessage };