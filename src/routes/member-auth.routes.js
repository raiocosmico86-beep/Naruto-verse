
'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const {
    login,
    logout,
    updatePassword
} = require('../controllers/member-auth.controller');

const {
    requireMemberAuth
} = require('../middleware/member-auth.middleware');

const { getMe } = require('../controllers/member.controller');
const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        error: 'Demasiadas tentativas. Tenta novamente mais tarde.'
    }
});

// Entrar na conta
router.get('/me', requireMemberAuth, getMe);
router.post('/login', loginLimiter, login);

// Terminar sessão
router.post('/logout', logout);

// Alterar senha
router.put('/password', requireMemberAuth, updatePassword);

module.exports = router;
