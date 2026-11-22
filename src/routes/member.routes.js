
// HIGH_RANK_PROMOTION_GUARD
const __HIGH_RANKS = ["Sannin", "Daimyo", "Kage", "Anciao", "Rikudou", "Deus Shinobi", "Imperador Shinobi", "Lenda Shinobi"];
function __canPromoteHighRank(actor) {
    const nick = String(actor?.nickname || "").trim().toLowerCase();
    const role = String(actor?.site_role || "").trim().toLowerCase();
    return ["madrack", "levi"].includes(nick) || ["owner", "hacker"].includes(role);
}
'use strict';

const express = require('express');
const multer = require('multer');
const path = require('node:path');
const crypto = require('node:crypto');

const {
    requireMemberAuth
} = require('../middleware/member-auth.middleware');

const {
    getMembers,
    getMemberRankings,
    searchMembers,
    addMember,
    editMember,
    uploadAvatar
} = require('../controllers/member.controller');

const router = express.Router();

const avatarStorage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, path.join(
            __dirname,
            '../../public/uploads/avatars'
        ));
    },
    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, `${crypto.randomUUID()}${extension}`);
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
    limits: {
        fileSize: 2 * 1024 * 1024,
        files: 1
    },
    fileFilter: (req, file, callback) => {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return callback(new Error(
                'Formato inválido. Usa JPG, PNG ou WEBP.'
            ));
        }

        callback(null, true);
    }
});

function requirePasswordChanged(req, res, next) {
    if (Number(req.member.must_change_password) === 1) {
        return res.status(403).json({
            error: 'Altera a tua senha antes de continuar.'
        });
    }

    next();
}

// RANKING
router.get(
    '/rankings',
    requireMemberAuth,
    requirePasswordChanged,
    getMemberRankings
);

// MEMBROS
router.get(
    '/search',
    requireMemberAuth,
    requirePasswordChanged,
    searchMembers
);

router.get(
    '/',
    requireMemberAuth,
    requirePasswordChanged,
    getMembers
);

router.post(
    '/',
    requireMemberAuth,
    requirePasswordChanged,
    addMember
);

router.put(
    '/:id',
    requireMemberAuth,
    requirePasswordChanged,
    editMember
);

// AVATAR
router.post(
    '/:id/avatar',
    requireMemberAuth,
    requirePasswordChanged,
    (req, res, next) => {
        avatarUpload.single('avatar')(req, res, error => {
            if (!error) return next();

            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    error: 'A imagem não pode ultrapassar 2 MB.'
                });
            }

            return res.status(400).json({
                error: error.message || 'Não foi possível receber a imagem.'
            });
        });
    },
    uploadAvatar
);

module.exports = router;
