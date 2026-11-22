'use strict';

const {
    findValidMemberSession
} = require('../services/member-session.service');

// Verificar se o membro está autenticado
function requireMemberAuth(req, res, next) {
    const token = req.cookies?.shinobi_session;

    if (!token) {
        return res.status(401).json({
            error: 'Autenticação necessária'
        });
    }

    const session = findValidMemberSession(token);

    if (!session) {
        res.clearCookie('shinobi_session', {
            httpOnly: true,
            sameSite: 'strict',
            path: '/'
        });

        return res.status(401).json({
            error: 'Sessão inválida ou expirada'
        });
    }

    req.member = session;
    next();
}

// Exigir alteração da senha inicial
function requirePasswordChanged(req, res, next) {
    if (!req.member) {
        return res.status(401).json({
            error: 'Autenticação necessária'
        });
    }

    if (Number(req.member.must_change_password) === 1) {
        return res.status(403).json({
            error: 'Altera a tua senha antes de continuar.'
        });
    }

    next();
}

// Verificar se é Levi ou Madrack
function requireOwnerOrHacker(req, res, next) {
    if (!req.member) {
        return res.status(401).json({
            error: 'Autenticação necessária'
        });
    }

    const hasFullAccess = ['owner', 'hacker'].includes(
        req.member.site_role
    );

    if (!hasFullAccess) {
        return res.status(403).json({
            error: 'Acesso reservado à administração máxima'
        });
    }

    next();
}

// Verificar se é administrador
function requireAdmin(req, res, next) {
    if (!req.member) {
        return res.status(401).json({
            error: 'Autenticação necessária'
        });
    }

    const isAdmin = [
        'owner',
        'hacker',
        'clan_admin'
    ].includes(req.member.site_role);

    if (!isAdmin) {
        return res.status(403).json({
            error: 'Acesso reservado aos administradores'
        });
    }

    next();
}

// Verificar se o administrador pertence ao clã
function requireOwnClan(req, res, next) {
    if (!req.member) {
        return res.status(401).json({
            error: 'Autenticação necessária'
        });
    }

    if (['owner', 'hacker'].includes(req.member.site_role)) {
        return next();
    }

    if (
        req.member.site_role !== 'clan_admin' ||
        Number(req.member.is_clan_leader) !== 1
    ) {
        return res.status(403).json({
            error: 'Permissão insuficiente'
        });
    }

    const requestedClanId = Number(req.params.clanId);

    if (
        !Number.isInteger(requestedClanId) ||
        requestedClanId !== Number(req.member.clan_id)
    ) {
        return res.status(403).json({
            error: 'Só podes gerir o teu próprio clã'
        });
    }

    next();
}

module.exports = {
    requireMemberAuth,
    requirePasswordChanged,
    requireOwnerOrHacker,
    requireAdmin,
    requireOwnClan
};
