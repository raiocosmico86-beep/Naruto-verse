'use strict';

const db = require('../database/db');

const {
    generateSessionToken,
    hashSessionToken
} = require('./auth.service');

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

// Criar sessão
function createMemberSession(memberId) {
    const member = db.prepare(`
        SELECT id
        FROM members
        WHERE id = ? AND status = 'active'
    `).get(memberId);

    if (!member) {
        throw new Error('Membro não encontrado ou suspenso');
    }

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = Date.now() + SESSION_DURATION;

    db.prepare(`
        INSERT INTO member_sessions (
            member_id,
            token_hash,
            expires_at
        )
        VALUES (?, ?, ?)
    `).run(memberId, tokenHash, expiresAt);

    return {
        token,
        expiresAt
    };
}

// Procurar sessão válida
function findValidMemberSession(token) {
    if (
        typeof token !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(token)
    ) {
        return null;
    }

    const tokenHash = hashSessionToken(token);

    return db.prepare(`
        SELECT
            member_sessions.id AS session_id,
            members.id AS member_id,
            members.login_username,
            members.nickname,
            members.rank,
            members.title,
            members.site_role,
            members.is_clan_leader,
            members.clan_id,
            members.hp_current,
            members.hp_max,
            members.chakra_current,
            members.chakra_max,
            members.yen,
            members.must_change_password,
            members.status
        FROM member_sessions
        INNER JOIN members
            ON members.id = member_sessions.member_id
        WHERE member_sessions.token_hash = ?
            AND member_sessions.expires_at > ?
            AND members.status = 'active'
    `).get(tokenHash, Date.now()) || null;
}

// Eliminar sessão
function deleteMemberSession(token) {
    if (
        typeof token !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(token)
    ) {
        return;
    }

    const tokenHash = hashSessionToken(token);

    db.prepare(`
        DELETE FROM member_sessions
        WHERE token_hash = ?
    `).run(tokenHash);
}

// Eliminar sessões expiradas
function deleteExpiredMemberSessions() {
    const result = db.prepare(`
        DELETE FROM member_sessions
        WHERE expires_at <= ?
    `).run(Date.now());

    return result.changes;
}

// Eliminar todas as sessões de um membro
function deleteAllMemberSessions(memberId) {
    const result = db.prepare(`
        DELETE FROM member_sessions
        WHERE member_id = ?
    `).run(memberId);

    return result.changes;
}

module.exports = {
    createMemberSession,
    findValidMemberSession,
    deleteMemberSession,
    deleteExpiredMemberSessions,
    deleteAllMemberSessions
};
