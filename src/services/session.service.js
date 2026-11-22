'use strict';

const db = require('../database/db');

const {
    generateSessionToken,
    hashSessionToken
} = require('./auth.service');

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

// Criar uma nova sessão
function createSession(userId) {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);

    const expiresAt = Date.now() + SESSION_DURATION;

    db.prepare(`
        INSERT INTO sessions (
            user_id,
            token_hash,
            expires_at
        )
        VALUES (?, ?, ?)
    `).run(userId, tokenHash, expiresAt);

    return {
        token,
        expiresAt
    };
}

// Procurar uma sessão válida
function findValidSession(token) {
    if (typeof token !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(token)) {
        return null;
    }

    const tokenHash = hashSessionToken(token);

    return db.prepare(`
        SELECT
            sessions.id AS session_id,
            sessions.user_id,
            users.username,
            users.email,
            users.role,
            users.status
        FROM sessions
        INNER JOIN users
            ON users.id = sessions.user_id
        WHERE sessions.token_hash = ?
            AND sessions.expires_at > ?
            AND users.status = 'active'
    `).get(tokenHash, Date.now()) || null;
}

// Destruir uma sessão
function deleteSession(token) {
    if (typeof token !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(token)) {
        return;
    }

    const tokenHash = hashSessionToken(token);

    db.prepare(`
        DELETE FROM sessions
        WHERE token_hash = ?
    `).run(tokenHash);
}

// Limpar sessões expiradas
function deleteExpiredSessions() {
    const result = db.prepare(`
        DELETE FROM sessions
        WHERE expires_at <= ?
    `).run(Date.now());

    return result.changes;
}

module.exports = {
    createSession,
    findValidSession,
    deleteSession,
    deleteExpiredSessions
};
