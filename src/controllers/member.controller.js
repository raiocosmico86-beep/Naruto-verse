
// HIGH_RANK_PROMOTION_GUARD
const __HIGH_RANKS = ["Sannin", "Daimyo", "Kage", "Anciao", "Rikudou", "Deus Shinobi", "Imperador Shinobi", "Lenda Shinobi"];
function __canPromoteHighRank(actor) {
    const nick = String(actor?.nickname || "").trim().toLowerCase();
    const role = String(actor?.site_role || "").trim().toLowerCase();
    return ["madrack", "levi"].includes(nick) || ["owner", "hacker"].includes(role);
}
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const {
    createMember,
    findMemberById,
    listMembers,
    searchPublicMembers,
    updateMember
} = require('../services/member.service');

const VALID_RANKS = ['Gennin', 'Chunin', 'Jounin'];
const VALID_ROLES = ['owner', 'hacker', 'clan_admin', 'member'];

function getMe(req, res) {
    const member = findMemberById(req.member.member_id);

    if (!member || member.status !== 'active') {
        return res.status(401).json({
            error: 'Conta indisponível.'
        });
    }

    return res.status(200).json({ member });
}

function searchMembers(req, res) {
    const nickname = String(req.query.q || '').trim();

    if (nickname.length > 40) {
        return res.status(400).json({
            error: 'A pesquisa não pode ultrapassar 40 caracteres.'
        });
    }

    const members = searchPublicMembers(nickname);

    return res.status(200).json({ members });
}

function getMembers(req, res) {
    const isFullAccess = ['owner', 'hacker'].includes(
        req.member.site_role
    );

    const isClanAdmin =
        req.member.site_role === 'clan_admin' &&
        Number(req.member.is_clan_leader) === 1;

    if (!isFullAccess && !isClanAdmin) {
        return res.status(403).json({
            error: 'Não tens autorização para consultar os membros.'
        });
    }

    const members = listMembers(
        isFullAccess ? null : Number(req.member.clan_id)
    );

    return res.status(200).json({ members });
}

async function addMember(req, res) {
    const creatorRole = req.member.site_role;

    const isFullAccess = ['owner', 'hacker'].includes(creatorRole);
    const isClanAdmin =
        creatorRole === 'clan_admin' &&
        Number(req.member.is_clan_leader) === 1;

    if (!isFullAccess && !isClanAdmin) {
        return res.status(403).json({
            error: 'Não tens autorização para adicionar membros.'
        });
    }

    const body = req.body || {};

    if (
        typeof body.loginUsername !== 'string' ||
        typeof body.password !== 'string' ||
        typeof body.nickname !== 'string'
    ) {
        return res.status(400).json({
            error: 'Preenche loginUsername, password e nickname.'
        });
    }

    if (
        Buffer.byteLength(body.password, 'utf8') < 8 ||
        Buffer.byteLength(body.password, 'utf8') > 128
    ) {
        return res.status(400).json({
            error: 'A senha inicial deve ter entre 8 e 128 bytes.'
        });
    }

    const rawClanId = Object.hasOwn(body, 'clanId')
        ? Number(body.clanId)
        : Number(req.member.clan_id);

    if (!Number.isInteger(rawClanId) || rawClanId < 1) {
        return res.status(400).json({
            error: 'Clã inválido.'
        });
    }

    if (
        isClanAdmin &&
        !isFullAccess &&
        rawClanId !== Number(req.member.clan_id)
    ) {
        return res.status(403).json({
            error: 'Só podes adicionar membros ao teu próprio clã.'
        });
    }

    let siteRole = 'member';
    let isClanLeader = false;

    if (Object.hasOwn(body, 'siteRole')) {
        if (!isFullAccess) {
            return res.status(403).json({
                error: 'Não tens permissão para definir a função no site.'
            });
        }

        if (!VALID_ROLES.includes(body.siteRole)) {
            return res.status(400).json({
                error: 'Permissão inválida.'
            });
        }

        siteRole = body.siteRole;
    }

    if (Object.hasOwn(body, 'isClanLeader')) {
        if (!isFullAccess) {
            return res.status(403).json({
                error: 'Não tens permissão para definir liderança de clã.'
            });
        }

        if (typeof body.isClanLeader !== 'boolean') {
            return res.status(400).json({
                error: 'Estado de liderança inválido.'
            });
        }

        isClanLeader = body.isClanLeader;
    }

    const rank = Object.hasOwn(body, 'rank') ? body.rank : 'Gennin';
    if (__HIGH_RANKS.includes(String(rank || "").trim()) && !__canPromoteHighRank(req.member)) {
        return res.status(403).json({ error: "Apenas Madrack e Levi podem promover para Sannin ou patentes superiores." });
    }

    if (!VALID_RANKS.includes(rank)) {
        return res.status(400).json({
            error: 'Patente inválida.'
        });
    }

    let title = null;
    if (Object.hasOwn(body, 'title') && body.title !== null) {
        if (typeof body.title !== 'string' || body.title.trim().length > 60) {
            return res.status(400).json({
                error: 'Cargo inválido.'
            });
        }
        title = body.title.trim() || null;
    }

    const yen = Object.hasOwn(body, 'yen') ? body.yen : 20;
    if (!Number.isSafeInteger(yen) || yen < 0) {
        return res.status(400).json({
            error: 'Saldo de Yens inválido.'
        });
    }

    try {
        const created = await createMember({
            loginUsername: body.loginUsername,
            password: body.password,
            nickname: body.nickname,
            clanId: rawClanId,
            rank,
            title,
            siteRole,
            isClanLeader,
            yen
        });

        return res.status(201).json({
            message: 'Membro criado com sucesso. Troca de senha obrigatória no primeiro acesso.',
            member: created
        });
    } catch (error) {
        if (
            error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
            error.message === 'Nome de login já existe'
        ) {
            return res.status(409).json({
                error: 'Já existe um membro com esse nome de login.'
            });
        }

        if (
            [
                'Dados inválidos',
                'Nome de login inválido',
                'Nick inválido',
                'Patente inválida',
                'Permissão inválida',
                'Clã inválido',
                'Saldo inválido',
                'Clã não encontrado'
            ].includes(error.message)
        ) {
            return res.status(400).json({
                error: error.message
            });
        }

        throw error;
    }
}

function editMember(req, res) {
    const targetId = Number(req.params.id);

    if (!Number.isInteger(targetId) || targetId < 1) {
        return res.status(400).json({
            error: 'Identificador de membro inválido.'
        });
    }

    const target = findMemberById(targetId);

    if (!target) {
        return res.status(404).json({
            error: 'Membro não encontrado.'
        });
    }

    const editorId = Number(req.member.member_id);
    const editorRole = req.member.site_role;

    const isSelf = editorId === targetId;
    const isFullAccess = ['owner', 'hacker'].includes(editorRole);

    const isClanAdmin =
        editorRole === 'clan_admin' &&
        Number(req.member.is_clan_leader) === 1;

    if (!isSelf && !isFullAccess && !isClanAdmin) {
        return res.status(403).json({
            error: 'Não tens autorização para editar este membro.'
        });
    }

    if (
        isClanAdmin &&
        !isFullAccess &&
        Number(target.clan_id) !== Number(req.member.clan_id)
    ) {
        return res.status(403).json({
            error: 'Só podes editar membros do teu próprio clã.'
        });
    }

    const body = req.body || {};
    const fields = {};

    if (Object.hasOwn(body, 'nickname')) {
        if (
            typeof body.nickname !== 'string' ||
            body.nickname.trim().length < 2 ||
            body.nickname.trim().length > 40
        ) {
            return res.status(400).json({
                error: 'O nickname deve ter entre 2 e 40 caracteres.'
            });
        }

        fields.nickname = body.nickname.trim();
    }

    const canManageRpg = isFullAccess || isClanAdmin;

    if (canManageRpg) {
        if (Object.hasOwn(body, 'rank')) {
            if (!VALID_RANKS.includes(body.rank)) {
                return res.status(400).json({
                    error: 'Patente inválida.'
                });
            }
            fields.rank = body.rank;
        }

        if (Object.hasOwn(body, 'title')) {
            if (
                body.title !== null &&
                (
                    typeof body.title !== 'string' ||
                    body.title.trim().length > 60
                )
            ) {
                return res.status(400).json({
                    error: 'Cargo inválido.'
                });
            }
            fields.title = body.title?.trim() || null;
        }

        if (Object.hasOwn(body, 'yen')) {
            if (!Number.isSafeInteger(body.yen) || body.yen < 0) {
                return res.status(400).json({
                    error: 'Saldo de Yens inválido.'
                });
            }
            fields.yen = body.yen;
        }
    }

    if (isFullAccess) {
        for (const field of ['wins', 'losses']) {
            if (!Object.hasOwn(body, field)) continue;

            if (
                !Number.isSafeInteger(body[field]) ||
                body[field] < 0
            ) {
                return res.status(400).json({
                    error: field === 'wins'
                        ? 'Número de vitórias inválido.'
                        : 'Número de derrotas inválido.'
                });
            }

            fields[field] = body[field];
        }
    } else if (
        Object.hasOwn(body, 'wins') ||
        Object.hasOwn(body, 'losses')
    ) {
        return res.status(403).json({
            error: 'Só Levi e Madrack podem alterar vitórias e derrotas.'
        });
    }

    if (isFullAccess) {
        if (Object.hasOwn(body, 'clanId')) {
            const clanId = Number(body.clanId);

            if (!Number.isInteger(clanId) || clanId < 1) {
                return res.status(400).json({
                    error: 'Clã inválido.'
                });
            }
            fields.clanId = clanId;
        }

        if (Object.hasOwn(body, 'siteRole')) {
            if (!VALID_ROLES.includes(body.siteRole)) {
                return res.status(400).json({
                    error: 'Permissão inválida.'
                });
            }
            fields.siteRole = body.siteRole;
        }

        if (Object.hasOwn(body, 'isClanLeader')) {
            if (typeof body.isClanLeader !== 'boolean') {
                return res.status(400).json({
                    error: 'Estado de liderança inválido.'
                });
            }
            fields.isClanLeader = body.isClanLeader;
        }
    }

    if (Object.keys(fields).length === 0) {
        return res.status(400).json({
            error: 'Nenhum campo permitido para alteração.'
        });
    }

    try {
        const updated = updateMember(targetId, fields);

        return res.status(200).json({
            message: 'Membro atualizado com sucesso.',
            member: updated
        });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({
                error: 'Já existe um membro com esse nickname no clã.'
            });
        }
        throw error;
    }
}

function hasImageSignature(buffer, mimetype) {
    if (mimetype === 'image/jpeg') {
        return buffer.length >= 3 &&
            buffer[0] === 0xff &&
            buffer[1] === 0xd8 &&
            buffer[2] === 0xff;
    }

    if (mimetype === 'image/png') {
        return buffer.length >= 8 &&
            buffer.subarray(0, 8).equals(
                Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
            );
    }

    if (mimetype === 'image/webp') {
        return buffer.length >= 12 &&
            buffer.toString('ascii', 0, 4) === 'RIFF' &&
            buffer.toString('ascii', 8, 12) === 'WEBP';
    }

    return false;
}

async function uploadAvatar(req, res) {
    const targetId = Number(req.params.id);
    const editorId = Number(req.member.member_id);
    const isFullAccess = ['owner', 'hacker'].includes(
        req.member.site_role
    );

    if (!Number.isInteger(targetId) || targetId < 1) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
            error: 'Identificador de membro inválido.'
        });
    }

    if (editorId !== targetId && !isFullAccess) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        return res.status(403).json({
            error: 'Só podes alterar a tua própria fotografia.'
        });
    }

    if (!req.file) {
        return res.status(400).json({
            error: 'Seleciona uma imagem primeiro.'
        });
    }

    const target = findMemberById(targetId);

    if (!target) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(404).json({
            error: 'Membro não encontrado.'
        });
    }

    const buffer = await fs.readFile(req.file.path);

    if (!hasImageSignature(buffer, req.file.mimetype)) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
            error: 'O ficheiro enviado não é uma imagem válida.'
        });
    }

    const avatarPath = `uploads/avatars/${req.file.filename}`;

    try {
        const db = require('../database/db');

        db.prepare(`
            UPDATE members
            SET avatar_path = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(avatarPath, targetId);

        if (target.avatar_path) {
            const oldName = path.basename(target.avatar_path);
            const oldPath = path.join(
                __dirname,
                '../../public/uploads/avatars',
                oldName
            );

            await fs.unlink(oldPath).catch(() => {});
        }

        return res.status(200).json({
            message: 'Fotografia de perfil atualizada.',
            member: findMemberById(targetId)
        });
    } catch (error) {
        await fs.unlink(req.file.path).catch(() => {});
        throw error;
    }
}

function getMemberRankings(req, res) {
    const { getRankings } = require('../services/ranking.service');

    const result = getRankings(req.member.member_id);

    return res.status(200).json(result);
}

module.exports = {
    getMe,
    getMembers,
    searchMembers,
    getMemberRankings,
    addMember,
    editMember,
    uploadAvatar
};
