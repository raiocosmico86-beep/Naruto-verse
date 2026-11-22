
'use strict';

const db = require('./db');
const { createMember } = require('../services/member.service');

const members = [
    // CLÃ UCHIHA
    {
        loginUsername: 'takeomi',
        nickname: 'Takeomi',
        clan: 'Uchiha',
        rank: 'Gennin',
        title: 'Sannin',
        siteRole: 'clan_admin',
        isClanLeader: true,
        yen: 2000
    },
    {
        loginUsername: 'juno',
        nickname: 'Juno',
        clan: 'Uchiha',
        rank: 'Gennin',
        yen: 1500
    },
    {
        loginUsername: 'nabi',
        nickname: 'Nabi',
        clan: 'Uchiha',
        rank: 'Gennin',
        yen: 20
    },
    {
        loginUsername: 'kill',
        nickname: 'Kill',
        clan: 'Uchiha',
        rank: 'Gennin',
        yen: 20
    },
    {
        loginUsername: 'itachi',
        nickname: 'Itachi',
        clan: 'Uchiha',
        rank: 'Gennin',
        yen: 20
    },
    {
        loginUsername: 'madrack',
        nickname: 'Madrack',
        clan: 'Uchiha',
        rank: 'Gennin',
        title: 'Hacker do RPG',
        siteRole: 'hacker',
        isClanLeader: false,
        yen: 40
    },
    // CLÃ UZUMAKI
    {
        loginUsername: 'mikasa',
        nickname: 'Mikasa',
        clan: 'Uzumaki',
        rank: 'Gennin',
        siteRole: 'clan_admin',
        isClanLeader: true,
        yen: 940
    },
    {
        loginUsername: 'cebolinha',
        nickname: 'Cebolinha',
        clan: 'Uzumaki',
        rank: 'Chunin',
        yen: 1310
    },
    {
        loginUsername: 'rujemaru',
        nickname: 'Rujemaru',
        clan: 'Uzumaki',
        rank: 'Gennin',
        yen: 20
    },
    {
        loginUsername: 'genesis',
        nickname: 'Genesis',
        clan: 'Uzumaki',
        rank: 'Gennin',
        yen: 20
    },
    {
        loginUsername: 'yumin',
        nickname: 'Yumin',
        clan: 'Uzumaki',
        rank: 'Gennin',
        yen: 250
    },

    // CLÃ HYUGA
    {
        loginUsername: 'levi',
        nickname: 'Levi',
        clan: 'Hyuga',
        rank: 'Chunin',
        title: 'Lenda Shinobi',
        siteRole: 'owner',
        isClanLeader: true,
        yen: 5000
    },
    {
        loginUsername: 'shipe',
        nickname: 'Shipe',
        clan: 'Hyuga',
        rank: 'Gennin',
        yen: 20
    },
    {
        loginUsername: 'yumi',
        nickname: 'Yumi',
        clan: 'Hyuga',
        rank: 'Gennin',
        yen: 20
    },
    {
        loginUsername: 'amai',
        nickname: 'Amai',
        clan: 'Hyuga',
        rank: 'Gennin',
        yen: 20
    },

    // CLÃ SENJU
    {
        loginUsername: 'dummy',
        nickname: 'Dummy',
        clan: 'Senju',
        rank: 'Chunin',
        siteRole: 'clan_admin',
        isClanLeader: true,
        yen: 6500
    },
    {
        loginUsername: 'kaito',
        nickname: 'Kaito',
        clan: 'Senju',
        rank: 'Gennin',
        yen: 640
    },
    {
        loginUsername: 'goku',
        nickname: 'Goku',
        clan: 'Senju',
        rank: 'Gennin',
        yen: 20
    },
    {
        loginUsername: 'daiki',
        nickname: 'Daiki',
        clan: 'Senju',
        rank: 'Gennin',
        yen: 380
    }
];

async function seedMembers() {
    const password = process.env.INITIAL_MEMBER_PASSWORD;

    if (
        typeof password !== 'string' ||
        Buffer.byteLength(password, 'utf8') < 8 ||
        Buffer.byteLength(password, 'utf8') > 128
    ) {
        throw new Error('Senha inicial inválida ou não fornecida.');
    }

    let created = 0;
    let skipped = 0;

    for (const member of members) {
        const existing = db.prepare(`
            SELECT id FROM members
            WHERE login_username = ?
        `).get(member.loginUsername);

        if (existing) {
            console.log(`[EXISTENTE] ${member.nickname}`);
            skipped++;
            continue;
        }

        const clan = db.prepare(`
            SELECT id FROM clans
            WHERE name = ?
        `).get(member.clan);

        if (!clan) {
            throw new Error(`Clã não encontrado: ${member.clan}`);
        }

        await createMember({
            loginUsername: member.loginUsername,
            password,
            nickname: member.nickname,
            clanId: clan.id,
            rank: member.rank,
            title: member.title || null,
            siteRole: member.siteRole || 'member',
            isClanLeader: member.isClanLeader || false,
            yen: member.yen
        });

        console.log(`[CRIADO] ${member.nickname} - ${member.clan}`);
        created++;
    }

    console.log('\n================================');
    console.log('   CADASTRO CONCLUÍDO');
    console.log('================================');
    console.log(`Contas criadas: ${created}`);
    console.log(`Contas já existentes: ${skipped}`);
    console.log(`Total de jogadores: ${members.length}`);
}

seedMembers()
    .catch((error) => {
        console.error('[ERRO NO CADASTRO]', error.message);
        process.exitCode = 1;
    })
    .finally(() => {
        db.close();
    });
