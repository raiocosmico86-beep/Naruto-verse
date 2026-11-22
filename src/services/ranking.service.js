'use strict';

const db = require('../database/db');
require('../database/ranking-migration');

function getRankingMembers() {
    return db.prepare(`
        SELECT
            members.id,
            members.nickname,
            members.avatar_path,
            members.rank,
            members.yen,
            members.wins,
            members.losses,
            clans.name AS clan
        FROM members
        LEFT JOIN clans ON clans.id = members.clan_id
        WHERE members.status = 'active'
    `).all();
}

function buildRanking(members, field, direction = 'DESC') {
    const sorted = [...members].sort((a, b) => {
        const difference = Number(b[field]) - Number(a[field]);

        if (difference !== 0) {
            return direction === 'DESC' ? difference : -difference;
        }

        return a.nickname.localeCompare(b.nickname);
    });

    return sorted.map((member, index) => ({
        position: index + 1,
        id: member.id,
        nickname: member.nickname,
        avatar_path: member.avatar_path,
        rank: member.rank,
        clan: member.clan,
        value: Number(member[field])
    }));
}

function getRankings(memberId) {
    const members = getRankingMembers();

    const yen = buildRanking(members, 'yen');
    const wins = buildRanking(members, 'wins');
    const losses = buildRanking(members, 'losses');

    const rankOrder = {
        Jounin: 3,
        Chunin: 2,
        Gennin: 1
    };

    const ranks = [...members]
        .sort((a, b) => {
            const difference =
                (rankOrder[b.rank] || 0) - (rankOrder[a.rank] || 0);

            if (difference !== 0) return difference;

            return a.nickname.localeCompare(b.nickname);
        })
        .map((member, index) => ({
            position: index + 1,
            id: member.id,
            nickname: member.nickname,
            avatar_path: member.avatar_path,
            rank: member.rank,
            clan: member.clan,
            value: member.rank
        }));

    const findPosition = list => {
        const entry = list.find(item => item.id === Number(memberId));
        return entry ? entry.position : null;
    };

    return {
        rankings: {
            yen,
            wins,
            losses,
            ranks
        },
        myPositions: {
            yen: findPosition(yen),
            wins: findPosition(wins),
            losses: findPosition(losses),
            ranks: findPosition(ranks)
        }
    };
}

module.exports = {
    getRankings
};
