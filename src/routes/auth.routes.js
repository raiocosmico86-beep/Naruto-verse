'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const {
    register,
    login
} = require('../controllers/auth.controller');

const router = express.Router();

// Limitar tentativas de registo
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        error: 'Demasiadas tentativas de registo. Tenta novamente mais tarde.'
    }
});

// Limitar tentativas de login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        error: 'Demasiadas tentativas de login. Tenta novamente mais tarde.'
    }
});

// Rotas
router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);

module.exports = router;
