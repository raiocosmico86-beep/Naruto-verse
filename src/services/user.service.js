'use strict';

const db = require('../database/db');
const { hashPassword } = require('./auth.service');

async function createUser({ username, email, password }) {
    if (
        typeof username !== 'string' ||
        typeof email !== 'string' ||
        typeof password !== 'string'
    ) {
        throw new Error('Dados inválidos');
    }

    username = username.trim();
    email = email.trim().toLowerCase();

    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
        throw new Error('Username inválido');
    }

    if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254
    ) {
        throw new Error('Email inválido');
    }

    const existingUser = db.prepare(`
        SELECT id FROM users
        WHERE username = ? OR email = ?
    `).get(username, email);

    if (existingUser) {
        throw new Error('Username ou email já registado');
    }

    const passwordHash = await hashPassword(password);

    const result = db.prepare(`
        INSERT INTO users (
            username,
            email,
            password_hash
        )
        VALUES (?, ?, ?)
    `).run(username, email, passwordHash);

    return db.prepare(`
        SELECT id, username, email, role, status, created_at
        FROM users
        WHERE id = ?
    `).get(result.lastInsertRowid);
}

// Procurar utilizador para autenticação
function findUserForLogin(identifier) {
    if (
        typeof identifier !== 'string' ||
        identifier.trim().length === 0
    ) {
        return null;
    }

    const normalizedIdentifier = identifier.trim();

    return db.prepare(`
        SELECT
            id,
            username,
            email,
            password_hash,
            role,
            status
        FROM users
        WHERE username = ? OR email = ?
    `).get(normalizedIdentifier, normalizedIdentifier) || null;
}

module.exports = {
    createUser,
    findUserForLogin
};
