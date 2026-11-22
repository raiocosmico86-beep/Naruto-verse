'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const {
    listCards,
    findCardById,
    createCard,
    updateCardImage,
    buyCard
} = require('../services/card.service');

function getCards(req, res) {
    const cards = listCards(req.member.member_id);
    return res.status(200).json({ cards });
}

async function addCard(req, res) {
    const isAdmin = ['owner', 'hacker'].includes(req.member.site_role);

    if (!isAdmin) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        return res.status(403).json({
            error: 'Apenas administradores podem adicionar cards.'
        });
    }

    const body = req.body || {};
    const title = String(body.title || '').trim();
    const category = String(body.category || 'Bukijutsu').trim();
    const chakraCost = String(body.chakraCost || '').trim();
    const damagePower = String(body.damagePower || '').trim();
    const description = String(body.description || '').trim();
    const effectText = String(body.effectText || '').trim();
    const authorTag = String(body.authorTag || '').trim();
    const priceYen = Number(body.priceYen);

    if (!title || title.length > 60) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
            error: 'Nome do card invalido (1 a 60 caracteres).'
        });
    }

    if (!description || description.length > 1500) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
            error: 'Descricao obrigatoria (ate 1500 caracteres).'
        });
    }

    if (!Number.isSafeInteger(priceYen) || priceYen < 0) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
            error: 'Preco em Yens invalido.'
        });
    }

    const imagePath = req.file
        ? `uploads/cards/${req.file.filename}`
        : null;

    try {
        const card = createCard({
            title,
            authorTag: authorTag || null,
            category: category || 'Bukijutsu',
            chakraCost: chakraCost || '0% 🔹',
            damagePower: damagePower || '0% 🔺',
            effectText: effectText || null,
            description,
            priceYen,
            imagePath,
            createdBy: req.member.member_id
        });

        return res.status(201).json({
            message: 'Card adicionado a loja com sucesso.',
            card
        });
    } catch (error) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        throw error;
    }
}

async function changeCardImage(req, res) {
    const cardId = Number(req.params.id);
    if (!Number.isInteger(cardId) || cardId < 1) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: 'ID de card invalido.' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'Escolha uma imagem da galeria.' });
    }

    const currentCard = findCardById(cardId);
    if (!currentCard) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(404).json({ error: 'Card nao encontrado.' });
    }

    const newImagePath = `uploads/cards/${req.file.filename}`;
    const updated = updateCardImage(cardId, newImagePath, req.member.member_id);

    if (currentCard.image_path && currentCard.image_path.startsWith('uploads/cards/')) {
        const oldFile = path.join(__dirname, '../../public', currentCard.image_path);
        await fs.unlink(oldFile).catch(() => {});
    }

    return res.status(200).json({
        message: 'Imagem do card atualizada!',
        card: updated
    });
}

function purchaseCard(req, res) {
    const cardId = Number(req.params.id);

    if (!Number.isInteger(cardId) || cardId < 1) {
        return res.status(400).json({
            error: 'ID de card invalido.'
        });
    }

    const result = buyCard(req.member.member_id, cardId);

    if (result.error) {
        return res.status(result.status || 400).json({
            error: result.error
        });
    }

    return res.status(200).json({
        message: 'Card comprado com sucesso!',
        card: result.card,
        member: result.member
    });
}

module.exports = {
    getCards,
    addCard,
    changeCardImage,
    purchaseCard
};
