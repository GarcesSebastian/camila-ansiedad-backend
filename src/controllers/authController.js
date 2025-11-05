const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const Institution = require('../models/Institution');

// Generar token JWT
const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback-secret', {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
};

// Registrar nuevo usuario (ahora con soporte para instituciones)
exports.register = async (req, res) => {
    try {
        const { email, password, name, age, institutionCode, institutionalPath, acceptedTerms } = req.body;

        // ✅ VALIDAR TÉRMINOS Y CONDICIONES
        if (!acceptedTerms) {
            return res.status(400).json({
                success: false,
                message: 'Debes aceptar los términos y condiciones para registrarte'
            });
        }

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe un usuario con este email'
            });
        }

        let userData = {
            email,
            password,
            name,
            age,
            acceptedTerms: true // ✅ Asegurar que sea true
        };

        // Si viene institutionCode, es un usuario institucional
        if (institutionCode) {
            const institution = await Institution.findOne({ 
                'settings.institutionCode': institutionCode,
                isActive: true 
            });
            
            if (!institution) {
                return res.status(400).json({
                    success: false,
                    message: 'Código de institución inválido'
                });
            }

            userData.institution = institution._id;
            userData.institutionalPath = institutionalPath || {};
        }

        // Crear nuevo usuario
        const newUser = await User.create(userData);

        // Generar token
        const token = signToken(newUser._id);

        // Crear sesión
        await Session.create({
            userId: newUser._id,
            token: token
        });

        // Actualizar último login
        await User.findByIdAndUpdate(newUser._id, { lastLogin: new Date() });

        // Populate institution data for response
        const userWithInstitution = await User.findById(newUser._id)
            .populate('institution')
            .populate('institutionalPath.program')
            .populate('institutionalPath.faculty')
            .populate('institutionalPath.career');

        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente',
            data: {
                user: {
                    id: userWithInstitution._id,
                    email: userWithInstitution.email,
                    name: userWithInstitution.name,
                    age: userWithInstitution.age,
                    role: userWithInstitution.role,
                    institution: userWithInstitution.institution,
                    institutionalPath: userWithInstitution.institutionalPath
                },
                token
            }
        });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor: ' + error.message
        });
    }
};

// Iniciar sesión (actualizado para manejar roles)
exports.login = async (req, res) => {
    try {
        const { email, password, acceptedTerms } = req.body;

        // ✅ MODIFICADO: Solo validar términos en el frontend, no en el backend para login
        // Los usuarios existentes pueden no tener el campo acceptedTerms
        // if (!acceptedTerms) {
        //     return res.status(400).json({
        //         success: false,
        //         message: 'Debes aceptar los términos y condiciones para iniciar sesión'
        //     });
        // }

        // Verificar si el usuario existe y la contraseña es correcta
        const user = await User.findOne({ email })
            .select('+password')
            .populate('institution')
            .populate('institutionalPath.program')
            .populate('institutionalPath.faculty')
            .populate('institutionalPath.career')
            .populate('expertProfile.assignedPrograms')
            .populate('expertProfile.assignedFaculties')
            .populate('expertProfile.assignedCareers');
        
        if (!user || !(await user.correctPassword(password, user.password))) {
            return res.status(401).json({
                success: false,
                message: 'Email o contraseña incorrectos'
            });
        }

        // Verificar que el usuario esté activo
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Tu cuenta ha sido desactivada. Contacta al administrador.'
            });
        }

        // ✅ MODIFICADO: Actualizar usuarios existentes que no tienen acceptedTerms
        if (!user.acceptedTerms) {
            user.acceptedTerms = true;
            await user.save();
            console.log(`✅ Usuario ${user.email} actualizado con acceptedTerms: true`);
        }

        // Generar token
        const token = signToken(user._id);

        // Crear sesión
        await Session.create({
            userId: user._id,
            token: token
        });

        // Actualizar último login
        await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

        // Preparar respuesta según el rol
        let userResponse = {
            id: user._id,
            email: user.email,
            name: user.name,
            age: user.age,
            role: user.role,
            institution: user.institution,
            institutionalPath: user.institutionalPath,
            acceptedTerms: user.acceptedTerms // ✅ Incluir en respuesta
        };

        // Agregar información adicional según el rol
        if (user.role === 'expert') {
            userResponse.expertProfile = user.expertProfile;
        }

        res.json({
            success: true,
            message: 'Inicio de sesión exitoso',
            data: {
                user: userResponse,
                token
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor: ' + error.message
        });
    }
};

// Cerrar sesión
exports.logout = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        
        // Eliminar sesión
        await Session.deleteOne({ token });

        res.json({
            success: true,
            message: 'Sesión cerrada exitosamente'
        });

    } catch (error) {
        console.error('Error en logout:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Obtener perfil de usuario
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-__v')
            .populate('institution')
            .populate('institutionalPath.program')
            .populate('institutionalPath.faculty')
            .populate('institutionalPath.career')
            .populate('expertProfile.assignedPrograms')
            .populate('expertProfile.assignedFaculties')
            .populate('expertProfile.assignedCareers');

        res.json({
            success: true,
            data: {
                user
            }
        });

    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Registro para administradores institucionales (solo superadmin)
exports.registerInstitutionalAdmin = async (req, res) => {
    try {
        // Verificar que el usuario actual es superadmin
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para esta acción'
            });
        }

        const { email, password, name, institutionId } = req.body;

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe un usuario con este email'
            });
        }

        // Verificar que la institución existe
        const institution = await Institution.findById(institutionId);
        if (!institution) {
            return res.status(404).json({
                success: false,
                message: 'Institución no encontrada'
            });
        }

        // Crear administrador institucional
        const newAdmin = await User.create({
            email,
            password,
            name,
            role: 'institutional_admin',
            institution: institutionId,
            acceptedTerms: true // ✅ Asegurar que acepta términos
        });

        // Generar token si se desea
        const token = signToken(newAdmin._id);

        res.status(201).json({
            success: true,
            message: 'Administrador institucional creado exitosamente',
            data: {
                user: {
                    id: newAdmin._id,
                    email: newAdmin.email,
                    name: newAdmin.name,
                    role: newAdmin.role,
                    institution: institution
                },
                token
            }
        });

    } catch (error) {
        console.error('Error creando admin institucional:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor: ' + error.message
        });
    }
};