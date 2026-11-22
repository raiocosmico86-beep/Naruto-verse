
// HIGH_RANK_PROMOTION_GUARD
const __HIGH_RANKS = ["Sannin", "Daimyo", "Kage", "Anciao", "Rikudou", "Deus Shinobi", "Imperador Shinobi", "Lenda Shinobi"];
function __canPromoteHighRank(actor) {
    const nick = String(actor?.nickname || "").trim().toLowerCase();
    const role = String(actor?.site_role || "").trim().toLowerCase();
    return ["madrack", "levi"].includes(nick) || ["owner", "hacker"].includes(role);
}
'use strict';

const db = require('../database/db');
require('../database/avatar-migration');
require('../database/ranking-migration');
const { hashPassword } = require('./auth.service');

const VALID_RANKS = ['Gennin', 'Chunin', 'Jounin'];
const VALID_ROLES = ['owner', 'hacker', 'clan_admin', 'member'];

async function createMember({
    loginUsername,
    password,
    nickname,
    clanId,
    rank = 'Gennin',
    title = null,
    siteRole = 'member',
    isClanLeader = false,
    yen = 20
}) {
    if (
        typeof loginUsername !== 'string' ||
        typeof nickname !== 'string' ||
        typeof password !== 'string'
    ) {
        throw new Error('Dados inválidos');
    }

    loginUsername = loginUsername.trim().toLowerCase();
    nickname = nickname.trim();

    if (!/^[a-z0-9_]{3,30}$/.test(loginUsername)) {
        throw new Error('Nome de login inválido');
    }

    if (nickname.length < 2 || nickname.length > 40) {
        throw new Error('Nick inválido');
    }

    if (!VALID_RANKS.includes(rank)) {
        throw new Error('Patente inválida');
    }

    if (!VALID_ROLES.includes(siteRole)) {
        throw new Error('Permissão inválida');
    }

    if (!Number.isInteger(clanId) || clanId < 1) {
        throw new Error('Clã inválido');
    }

    if (!Number.isInteger(yen) || yen < 0) {
        throw new Error('Saldo inválido');
    }

    const clan = db.prepare(
        'SELECT id FROM clans WHERE id = ?'
    ).get(clanId);

    if (!clan) {
        throw new Error('Clã não encontrado');
    }

    const existingMember = db.prepare(
        'SELECT id FROM members WHERE login_username = ?'
    ).get(loginUsername);

    if (existingMember) {
        throw new Error('Nome de login já existe');
    }

    const passwordHash = await hashPassword(password);

    const result = db.prepare(`
        INSERT INTO members (
            login_username,
            password_hash,
            nickname,
            clan_id,
            rank,
            title,
            site_role,
            is_clan_leader,
            yen,
            must_change_password
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
        loginUsername,
        passwordHash,
        nickname,
        clanId,
        rank,
        title,
        siteRole,
        isClanLeader ? 1 : 0,
        yen
    );

    return findMemberById(result.lastInsertRowid);
}

function findMemberForLogin(loginUsername) {
    if (
        typeof loginUsername !== 'string' ||
        !loginUsername.trim()
    ) {
        return null;
    }

    return db.prepare(`
        SELECT *
        FROM members
        WHERE login_username = ?
    `).get(loginUsername.trim().toLowerCase()) || null;
}

function findMemberById(id) {
    return db.prepare(`
        SELECT
            members.id,
            members.login_username,
            members.nickname,
            members.avatar_path,
            members.rank,
            members.wins,
            members.losses,
            members.title,
            members.site_role,
            members.yen,
            members.must_change_password,
            members.status,
            members.is_clan_leader,
            members.clan_id,
            clans.name AS clan
        FROM members
        LEFT JOIN clans ON clans.id = members.clan_id
        WHERE members.id = ?
    `).get(id) || null;
}

async function changePassword(memberId, newPassword) {
    const passwordHash = await hashPassword(newPassword);

    const result = db.prepare(`
        UPDATE members
        SET
            password_hash = ?,
            must_change_password = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(passwordHash, memberId);

    return result.changes === 1;
}

function listMembers(clanId = null) {
    const query = `
        SELECT
            members.id,
            members.login_username,
            members.nickname,
            members.avatar_path,
            members.rank,
            members.wins,
            members.losses,
            members.title,
            members.site_role,
            members.is_clan_leader,
            members.clan_id,
            members.yen,
            members.status,
            clans.name AS clan
        FROM members
        LEFT JOIN clans ON clans.id = members.clan_id
        ${clanId === null ? '' : 'WHERE members.clan_id = ?'}
        ORDER BY members.nickname COLLATE NOCASE
    `;

    return clanId === null
        ? db.prepare(query).all()
        : db.prepare(query).all(clanId);
}

function searchPublicMembers(nickname) {
    const term = String(nickname || '').trim();

    if (!term) return [];

    return db.prepare(`
        SELECT
            members.id,
            members.nickname,
            members.avatar_path,
            members.rank,
            members.title,
            members.yen,
            clans.name AS clan
        FROM members
        LEFT JOIN clans ON clans.id = members.clan_id
        WHERE members.status = 'active'
          AND instr(lower(members.nickname), lower(?)) > 0
        ORDER BY members.nickname COLLATE NOCASE
        LIMIT 25
    `).all(term);
}

function updateMember(memberId, fields) {
    const columns = {
        nickname: 'nickname',
        rank: 'rank',
        wins: 'wins',
        losses: 'losses',
        title: 'title',
        clanId: 'clan_id',
        yen: 'yen',
        siteRole: 'site_role',
        isClanLeader: 'is_clan_leader'
    };

    const updates = [];
    const values = [];

    for (const [key, column] of Object.entries(columns)) {
        if (!Object.prototype.hasOwnProperty.call(fields, key)) {
            continue;
        }

        updates.push(`${column} = ?`);

        const value = key === 'isClanLeader'
            ? (fields[key] ? 1 : 0)
            : fields[key];

        values.push(value);
    }

    if (updates.length === 0) {
        return findMemberById(memberId);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(memberId);

    db.prepare(`
        UPDATE members
        SET ${updates.join(', ')}
        WHERE id = ?
    `).run(...values);

    return findMemberById(memberId);
}

module.exports = {
    createMember,
    findMemberForLogin,
    findMemberById,
    changePassword,
    listMembers,
    searchPublicMembers,
    updateMember
};
