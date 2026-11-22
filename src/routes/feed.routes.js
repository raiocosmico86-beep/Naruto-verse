'use strict';

const express = require('express');
const multer = require('multer');
const path = require('node:path');
const crypto = require('node:crypto');

const {
    requireMemberAuth,
    requirePasswordChanged
} = require('../middleware/member-auth.middleware');

const feedController = require('../controllers/feed.controller');

const router = express.Router();

const imageStorage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, path.join(
            __dirname,
            '../../public/uploads/posts'
        ));
    },
    filename: (req, file, callback) => {
        const extensions = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp'
        };

        callback(
            null,
            `${crypto.randomUUID()}${extensions[file.mimetype] || ''}`
        );
    }
});

const imageUpload = multer({
    storage: imageStorage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    },
    fileFilter: (req, file, callback) => {
        const allowed = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];

        if (!allowed.includes(file.mimetype)) {
            return callback(new Error(
                'Formato inválido. Usa JPG, PNG ou WEBP.'
            ));
        }

        callback(null, true);
    }
});

router.use(requireMemberAuth, requirePasswordChanged);

router.get('/', feedController.getFeed);

router.post(
    '/',
    (req, res, next) => {
        imageUpload.single('image')(req, res, error => {
            if (!error) return next();

            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    error: 'A imagem não pode ultrapassar 5 MB.'
                });
            }

            return res.status(400).json({
                error: error.message || 'Não foi possível receber a imagem.'
            });
        });
    },
    feedController.createPost
);

router.put('/:id', feedController.editPost);
router.delete('/:id', feedController.removePost);
router.post('/:id/like', feedController.likePost);
router.post('/:id/comments', feedController.addComment);
router.delete('/:id/comments/:commentId', feedController.removeComment);

module.exports = router;
