'use strict';

const db = require('../database/db');
require('../database/cards-migration');

function listCards(memberId) {
    return db.prepare(`
        SELECT
            cards.id,
            cards.title,
            cards.author_tag,
            cards.category,
            cards.chakra_cost,
            cards.damage_power,
            cards.effect_text,
            cards.description,
            cards.price_yen,
            cards.image_path,
            cards.created_at,
            COALESCE(member_cards.quantity, 0) AS owned_quantity
        FROM cards
        LEFT JOIN member_cards
            ON member_cards.card_id = cards.id
            AND member_cards.member_id = ?
        ORDER BY cards.id DESC
    `).all(Number(memberId));
}

function findCardById(cardId, memberId = null) {
    if (memberId !== null) {
        return db.prepare(`
            SELECT
                cards.id,
                cards.title,
                cards.author_tag,
                cards.category,
                cards.chakra_cost,
                cards.damage_power,
                cards.effect_text,
                cards.description,
                cards.price_yen,
                cards.image_path,
                cards.created_at,
                COALESCE(member_cards.quantity, 0) AS owned_quantity
            FROM cards
            LEFT JOIN member_cards
                ON member_cards.card_id = cards.id
                AND member_cards.member_id = ?
            WHERE cards.id = ?
        `).get(Number(memberId), Number(cardId)) || null;
    }

    return db.prepare(`
        SELECT *
        FROM cards
        WHERE id = ?
    `).get(Number(cardId)) || null;
}

function createCard(data) {
    const result = db.prepare(`
        INSERT INTO cards (
            title,
            author_tag,
            category,
            chakra_cost,
            damage_power,
            effect_text,
            description,
            price_yen,
            image_path,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        data.title,
        data.authorTag || null,
        data.category,
        data.chakraCost,
        data.damagePower,
        data.effectText || null,
        data.description,
        data.priceYen,
        data.imagePath || null,
        data.createdBy || null
    );

    return findCardById(result.lastInsertRowid, data.createdBy || null);
}

function updateCardImage(cardId, imagePath, memberId) {
    const existing = db.prepare('SELECT id FROM cards WHERE id = ?').get(Number(cardId));
    if (!existing) return null;

    db.prepare('UPDATE cards SET image_path = ? WHERE id = ?').run(imagePath, Number(cardId));
    return findCardById(Number(cardId), Number(memberId));
}

function buyCard(memberId, cardId) {
    const transaction = db.transaction((mId, cId) => {
        const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cId);
        if (!card) {
            return { error: 'Card nao encontrado.', status: 404 };
        }

        const alreadyOwned = db.prepare(
            'SELECT quantity FROM member_cards WHERE member_id = ? AND card_id = ?'
        ).get(mId, cId);

        if (alreadyOwned && Number(alreadyOwned.quantity) > 0) {
            return { error: 'Voce ja possui este card (compra unica).', status: 409 };
        }

        const memberRow = db.prepare(
            'SELECT id, yen, status FROM members WHERE id = ?'
        ).get(mId);

        if (!memberRow || memberRow.status !== 'active') {
            return { error: 'Conta indisponivel.', status: 401 };
        }

        const price = Number(card.price_yen || 0);
        if (Number(memberRow.yen || 0) < price) {
            return { error: 'Yens insuficientes para comprar este card.', status: 400 };
        }

        db.prepare(`
            UPDATE members
            SET yen = yen - ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(price, mId);

        db.prepare(`
            INSERT INTO member_cards (member_id, card_id, quantity)
            VALUES (?, ?, 1)
        `).run(mId, cId);

        const updatedMember = db.prepare(`
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
        `).get(mId);

        return {
            status: 200,
            card: findCardById(cId, mId),
            member: updatedMember
        };
    });

    return transaction(Number(memberId), Number(cardId));
}

module.exports = {
    listCards,
    findCardById,
    createCard,
    updateCardImage,
    buyCard
};
