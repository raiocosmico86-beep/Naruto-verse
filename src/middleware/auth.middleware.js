'use strict';

const { findValidSession } = require('../services/session.service');

function requireAuth(req, res, next) {
    const token = req.cookies?.shinobi_session;

    if (!token) {
        return res.status(401).json({
            error: 'Autenticação necessária'
        });
    }

    const session = findValidSession(token);

    if (!session) {
        return res.status(401).json({
            error: 'Sessão inválida ou expirada'
        });
    }

    req.user = {
        id: session.user_id,
        username: session.username,
        email: session.email,
        role: session.role
    };

    next();
}

module.exports = { requireAuth };
