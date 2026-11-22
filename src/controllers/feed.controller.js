'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const feedService = require('../services/feed.service');

function memberId(req) {
    return Number(req.member.member_id);
}

function hasFullAccess(req) {
    return ['owner', 'hacker'].includes(req.member.site_role);
}

function canManagePost(req, post) {
    return Number(post.member_id) === memberId(req) || hasFullAccess(req);
}

async function removeUploadedImage(filePath) {
    if (!filePath) return;

    try {
        await fs.unlink(filePath);
    } catch {
        // O ficheiro pode já não existir.
    }
}

function hasImageSignature(buffer, mimetype) {
    if (mimetype === 'image/jpeg') {
        return buffer.length >= 3 &&
            buffer[0] === 0xFF &&
            buffer[1] === 0xD8 &&
            buffer[2] === 0xFF;
    }

    if (mimetype === 'image/png') {
        return buffer.length >= 8 &&
            buffer.subarray(0, 8).equals(
                Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
            );
    }

    if (mimetype === 'image/webp') {
        return buffer.length >= 12 &&
            buffer.toString('ascii', 0, 4) === 'RIFF' &&
            buffer.toString('ascii', 8, 12) === 'WEBP';
    }

    return false;
}

async function getFeed(req, res) {
    res.json({
        posts: feedService.listPosts(memberId(req))
    });
}

async function createPost(req, res) {
    const content = typeof req.body.content === 'string'
        ? req.body.content.trim()
        : '';

    if (content.length > 2000) {
        await removeUploadedImage(req.file?.path);
        return res.status(400).json({
            error: 'A publicação não pode ultrapassar 2000 caracteres.'
        });
    }

    if (!content && !req.file) {
        return res.status(400).json({
            error: 'Escreve alguma coisa ou escolhe uma imagem.'
        });
    }

    let imagePath = null;

    if (req.file) {
        const buffer = await fs.readFile(req.file.path);

        if (!hasImageSignature(buffer, req.file.mimetype)) {
            await removeUploadedImage(req.file.path);
            return res.status(400).json({
                error: 'O ficheiro enviado não é uma imagem válida.'
            });
        }

        imagePath = `uploads/posts/${req.file.filename}`;
    }

    try {
        const post = feedService.createPost(
            memberId(req),
            content,
            imagePath
        );

        res.status(201).json({
            message: 'Publicação criada.',
            post
        });
    } catch (error) {
        await removeUploadedImage(req.file?.path);
        throw error;
    }
}

async function editPost(req, res) {
    const postId = Number(req.params.id);
    const post = feedService.findPostById(postId);

    if (!post) {
        return res.status(404).json({ error: 'Publicação não encontrada.' });
    }

    if (!canManagePost(req, post)) {
        return res.status(403).json({
            error: 'Só podes editar as tuas próprias publicações.'
        });
    }

    if (typeof req.body.content !== 'string') {
        return res.status(400).json({ error: 'Texto inválido.' });
    }

    const content = req.body.content.trim();

    if (content.length > 2000) {
        return res.status(400).json({
            error: 'A publicação não pode ultrapassar 2000 caracteres.'
        });
    }

    if (!content && !post.image_path) {
        return res.status(400).json({
            error: 'A publicação precisa de texto ou imagem.'
        });
    }

    res.json({
        message: 'Publicação atualizada.',
        post: feedService.updatePost(postId, content)
    });
}

async function removePost(req, res) {
    const post = feedService.findPostById(Number(req.params.id));

    if (!post) {
        return res.status(404).json({ error: 'Publicação não encontrada.' });
    }

    if (!canManagePost(req, post)) {
        return res.status(403).json({
            error: 'Só podes apagar as tuas próprias publicações.'
        });
    }

    feedService.deletePost(post.id);

    if (post.image_path) {
        await removeUploadedImage(path.join(
            __dirname,
            '../../public/uploads/posts',
            path.basename(post.image_path)
        ));
    }

    res.json({ message: 'Publicação removida.' });
}

async function likePost(req, res) {
    const post = feedService.findPostById(Number(req.params.id));

    if (!post) {
        return res.status(404).json({ error: 'Publicação não encontrada.' });
    }

    const liked = feedService.toggleLike(post.id, memberId(req));

    res.json({ liked });
}

async function addComment(req, res) {
    const post = feedService.findPostById(Number(req.params.id));

    if (!post) {
        return res.status(404).json({ error: 'Publicação não encontrada.' });
    }

    const content = typeof req.body.content === 'string'
        ? req.body.content.trim()
        : '';

    if (!content || content.length > 500) {
        return res.status(400).json({
            error: 'O comentário deve ter entre 1 e 500 caracteres.'
        });
    }

    res.status(201).json({
        message: 'Comentário publicado.',
        comment: feedService.createComment(
            post.id,
            memberId(req),
            content
        )
    });
}

async function removeComment(req, res) {
    const comment = feedService.findCommentById(Number(req.params.commentId));

    if (!comment || Number(comment.post_id) !== Number(req.params.id)) {
        return res.status(404).json({ error: 'Comentário não encontrado.' });
    }

    if (
        Number(comment.member_id) !== memberId(req) &&
        !hasFullAccess(req)
    ) {
        return res.status(403).json({
            error: 'Não tens permissão para apagar este comentário.'
        });
    }

    feedService.deleteComment(comment.id);
    res.json({ message: 'Comentário removido.' });
}

module.exports = {
    getFeed,
    createPost,
    editPost,
    removePost,
    likePost,
    addComment,
    removeComment
};
