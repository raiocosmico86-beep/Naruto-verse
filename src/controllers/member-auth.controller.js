'use strict';

const {
    findMemberForLogin,
    findMemberById,
    changePassword
} = require('../services/member.service');

const {
    verifyPassword
} = require('../services/auth.service');

const {
    createMemberSession,
    deleteMemberSession,
    deleteAllMemberSessions
} = require('../services/member-session.service');

const COOKIE_NAME = 'shinobi_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DURATION
};

async function login(req, res) {
    const { loginUsername, password } = req.body || {};

    if (
        typeof loginUsername !== 'string' ||
        typeof password !== 'string' ||
        !loginUsername.trim() ||
        !password
    ) {
        return res.status(400).json({
            error: 'Preenche o utilizador e a senha.'
        });
    }

    const member = findMemberForLogin(loginUsername);

    if (!member || member.status !== 'active') {
        return res.status(401).json({
            error: 'Credenciais inválidas.'
        });
    }

    const hasNoPasswordYet =
        !member.password_hash || Boolean(member.must_change_password);

    if (hasNoPasswordYet) {
        if (
            Buffer.byteLength(password, 'utf8') < 8 ||
            Buffer.byteLength(password, 'utf8') > 128
        ) {
            return res.status(400).json({
                error: 'Escolhe uma senha com entre 8 e 128 caracteres para definir na tua conta.'
            });
        }

        const saved = await changePassword(member.id, password);

        if (!saved) {
            return res.status(500).json({
                error: 'Não foi possível guardar a tua senha.'
            });
        }
    } else {
        const passwordIsValid = await verifyPassword(
            password,
            member.password_hash
        );

        if (!passwordIsValid) {
            return res.status(401).json({
                error: 'Credenciais inválidas.'
            });
        }
    }

    const session = await createMemberSession(member.id);
    const token = typeof session === 'string'
        ? session
        : session?.token;

    if (!token) {
        return res.status(500).json({
            error: 'Não foi possível criar a sessão.'
        });
    }

    res.cookie(COOKIE_NAME, token, cookieOptions);

    const safeMember = findMemberById(member.id);

    return res.status(200).json({
        message: hasNoPasswordYet
            ? 'Senha definida com sucesso. Agora ela é a tua senha de acesso.'
            : 'Login efetuado com sucesso.',
        member: safeMember
    });
}

function logout(req, res) {
    const token = req.cookies?.[COOKIE_NAME];

    if (token) {
        deleteMemberSession(token);
    }

    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
    });

    return res.status(200).json({
        message: 'Sessão terminada.'
    });
}

async function updatePassword(req, res) {
    const { currentPassword, newPassword } = req.body || {};

    if (typeof newPassword !== 'string' || !newPassword) {
        return res.status(400).json({
            error: 'Preenche a nova senha.'
        });
    }

    if (
        Buffer.byteLength(newPassword, 'utf8') < 8 ||
        Buffer.byteLength(newPassword, 'utf8') > 128
    ) {
        return res.status(400).json({
            error: 'A nova senha deve ter entre 8 e 128 bytes.'
        });
    }

    const member = findMemberForLogin(req.member.login_username);

    if (!member || member.status !== 'active') {
        return res.status(401).json({
            error: 'Conta inválida.'
        });
    }

    const hasNoPasswordYet =
        !member.password_hash || Boolean(member.must_change_password);

    if (!hasNoPasswordYet) {
        if (typeof currentPassword !== 'string' || !currentPassword) {
            return res.status(400).json({
                error: 'Preenche a senha atual e a nova senha.'
            });
        }

        const passwordIsValid = await verifyPassword(
            currentPassword,
            member.password_hash
        );

        if (!passwordIsValid) {
            return res.status(401).json({
                error: 'A senha atual está incorreta.'
            });
        }
    }

    const updated = await changePassword(
        req.member.member_id,
        newPassword
    );

    if (!updated) {
        return res.status(500).json({
            error: 'Não foi possível alterar a senha.'
        });
    }

    deleteAllMemberSessions(req.member.member_id);

    const session = await createMemberSession(req.member.member_id);
    const token = typeof session === 'string'
        ? session
        : session?.token;

    if (!token) {
        res.clearCookie(COOKIE_NAME, {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            path: '/'
        });

        return res.status(500).json({
            error: 'Senha alterada. Entra novamente na tua conta.'
        });
    }

    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.status(200).json({
        message: 'Senha alterada com sucesso.',
        member: findMemberById(req.member.member_id)
    });
}

module.exports = {
    login,
    logout,
    updatePassword
};
