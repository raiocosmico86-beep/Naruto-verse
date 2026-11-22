'use strict';

const express = require('express');
const multer = require('multer');
const path = require('node:path');
const crypto = require('node:crypto');

const { requireMemberAuth } = require('../middleware/member-auth.middleware');
const {
    getCards,
    addCard,
    changeCardImage,
    purchaseCard
} = require('../controllers/card.controller');

const router = express.Router();

const cardStorage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, path.join(__dirname, '../../public/uploads/cards'));
    },
    filename: (req, file, callback) => {
        const ext = path.extname(file.originalname).toLowerCase();
        callback(null, `${crypto.randomUUID()}${ext}`);
    }
});

const cardUpload = multer({
    storage: cardStorage,
    limits: {
        fileSize: 3 * 1024 * 1024,
        files: 1
    },
    fileFilter: (req, file, callback) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
            return callback(new Error('Formato invalido. Usa JPG, PNG ou WEBP.'));
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

function handleSingleImage(req, res, next) {
    cardUpload.single('image')(req, res, error => {
        if (!error) return next();
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                error: 'A imagem nao pode ultrapassar 3 MB.'
            });
        }
        return res.status(400).json({
            error: error.message || 'Falha ao enviar imagem.'
        });
    });
}

router.get('/', requireMemberAuth, requirePasswordChanged, getCards);
router.post('/', requireMemberAuth, requirePasswordChanged, handleSingleImage, addCard);
router.put('/:id/image', requireMemberAuth, requirePasswordChanged, handleSingleImage, changeCardImage);
router.post('/:id/buy', requireMemberAuth, requirePasswordChanged, purchaseCard);

module.exports = router;
