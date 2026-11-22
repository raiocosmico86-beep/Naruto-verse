'use strict';

const db = require('./db');

// Criar a nova estrutura do RPG sem apagar as tabelas antigas.
db.exec(`
    CREATE TABLE IF NOT EXISTS clans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        treasury_yen INTEGER
            CHECK (treasury_yen IS NULL OR treasury_yen >= 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        login_username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,

        nickname TEXT NOT NULL,
        clan_id INTEGER,

        rank TEXT NOT NULL DEFAULT 'Gennin'
            CHECK (rank IN ('Gennin', 'Chunin', 'Jounin')),

        title TEXT,

        site_role TEXT NOT NULL DEFAULT 'member'
            CHECK (
                site_role IN (
                    'owner',
                    'hacker',
                    'clan_admin',
                    'member'
                )
            ),

        is_clan_leader INTEGER NOT NULL DEFAULT 0
            CHECK (is_clan_leader IN (0, 1)),

        hp_max INTEGER NOT NULL DEFAULT 200,
        hp_current INTEGER NOT NULL DEFAULT 200,

        chakra_max INTEGER NOT NULL DEFAULT 400,
        chakra_current INTEGER NOT NULL DEFAULT 400,

        yen INTEGER NOT NULL DEFAULT 20
            CHECK (yen >= 0),

        must_change_password INTEGER NOT NULL DEFAULT 1
            CHECK (must_change_password IN (0, 1)),

        status TEXT NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'suspended')),

        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (clan_id)
            REFERENCES clans(id)
            ON DELETE RESTRICT,

        CHECK (hp_max > 0),
        CHECK (hp_current >= 0),
        CHECK (chakra_max > 0),
        CHECK (chakra_current >= 0)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_members_clan_nickname
        ON members(clan_id, nickname);

    CREATE INDEX IF NOT EXISTS idx_members_clan
        ON members(clan_id);

    CREATE INDEX IF NOT EXISTS idx_members_role
        ON members(site_role);

    CREATE TABLE IF NOT EXISTS member_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (member_id)
            REFERENCES members(id)
            ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_member_sessions_member
        ON member_sessions(member_id);

    CREATE INDEX IF NOT EXISTS idx_member_sessions_expiration
        ON member_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        member_id INTEGER,
        clan_id INTEGER,

        transaction_type TEXT NOT NULL
            CHECK (transaction_type IN ('credit', 'debit')),

        amount INTEGER NOT NULL CHECK (amount > 0),
        description TEXT NOT NULL,

        created_by_member_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (member_id)
            REFERENCES members(id)
            ON DELETE SET NULL,

        FOREIGN KEY (clan_id)
            REFERENCES clans(id)
            ON DELETE SET NULL,

        FOREIGN KEY (created_by_member_id)
            REFERENCES members(id)
            ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS world_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL
    );
`);

// Registar os quatro clãs.
const insertClan = db.prepare(`
    INSERT OR IGNORE INTO clans (name, treasury_yen)
    VALUES (?, ?)
`);

const createClans = db.transaction(() => {
    insertClan.run('Uchiha', null);
    insertClan.run('Uzumaki', 100);
    insertClan.run('Hyuga', 400);
    insertClan.run('Senju', 200);
});

createClans();

// Registar o tesouro da vila.
db.prepare(`
    INSERT OR IGNORE INTO world_settings (
        setting_key,
        setting_value
    )
    VALUES ('village_treasury_yen', '2000')
`).run();

console.log('');
console.log('================================');
console.log(' SHINOBI VERSE');
console.log(' RPG DATABASE STRUCTURE READY');
console.log('================================');

console.log('\nClãs registados:');

const clans = db.prepare(`
    SELECT name, treasury_yen
    FROM clans
    ORDER BY name
`).all();

console.table(clans);

console.log('\nNova estrutura criada com sucesso.');
console.log('As tabelas antigas foram preservadas.');

db.close();
