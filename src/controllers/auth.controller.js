'use strict';

const { createUser, findUserForLogin } = require('../services/user.service');

const {
    verifyPassword
} = require('../services/auth.service');

const {
    createSession
} = require('../services/session.service');

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

// REGISTAR UTILIZADOR
async function register(req, res) {
    try {
        const { username, email, password } = req.body || {};

        const user = await createUser({
            username,
            email,
            password
        });

        return res.status(201).json({
            message: 'Shinobi registado com sucesso',
            user
        });

    } catch (error) {
        console.error('[REGISTER ERROR]:', error.message);

        const validationErrors = [
            'Dados inválidos',
            'Username inválido',
            'Email inválido',
            'Palavra-passe inválida'
        ];

        if (validationErrors.includes(error.message)) {
            return res.status(400).json({
                error: error.message
            });
        }

        if (
            error.message === 'Username ou email já registado' ||
            error.code === 'SQLITE_CONSTRAINT_UNIQUE'
        ) {
            return res.status(409).json({
                error: 'Username ou email já registado'
            });
        }

        return res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
}

// AUTENTICAR UTILIZADOR
async function login(req, res) {
    try {
        const { identifier, password } = req.body || {};

        if (
            typeof identifier !== 'string' ||
            typeof password !== 'string' ||
            identifier.trim().length === 0 ||
            Buffer.byteLength(password, 'utf8') < 8 ||
            Buffer.byteLength(password, 'utf8') > 128
        ) {
            return res.status(400).json({
                error: 'Credenciais inválidas'
            });
        }

        const user = findUserForLogin(identifier);

        if (!user || user.status !== 'active') {
            return res.status(401).json({
                error: 'Credenciais incorretas'
            });
        }

        const passwordIsValid = await verifyPassword(
            password,
            user.password_hash
        );

        if (!passwordIsValid) {
            return res.status(401).json({
                error: 'Credenciais incorretas'
            });
        }

        const session = createSession(user.id);

        res.cookie('shinobi_session', session.token, {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            path: '/',
            maxAge: SESSION_DURATION
        });

        return res.status(200).json({
            message: 'Login efetuado com sucesso',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('[LOGIN ERROR]:', error.message);

        return res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
}

module.exports = {
    register,
    login
};
