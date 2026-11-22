'use strict';

const db = require('./db');

db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author_tag TEXT DEFAULT NULL,
        category TEXT NOT NULL DEFAULT 'Bukijutsu',
        chakra_cost TEXT NOT NULL DEFAULT '20% 🔹',
        damage_power TEXT NOT NULL DEFAULT '130% 🔺',
        effect_text TEXT DEFAULT NULL,
        description TEXT NOT NULL,
        price_yen INTEGER NOT NULL DEFAULT 100,
        image_path TEXT DEFAULT NULL,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS member_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        card_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(member_id, card_id),
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );
`);

const existing = db.prepare('SELECT COUNT(*) AS total FROM cards').get();

if (Number(existing?.total || 0) === 0) {
    db.prepare(`
        INSERT INTO cards (
            title,
            author_tag,
            category,
            chakra_cost,
            damage_power,
            effect_text,
            description,
            price_yen,
            image_path
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
        'Papel Bomba',
        'Forja Ferrari',
        'Bukijutsu',
        '20% 🔹',
        '130% 🔺',
        '-20% 💔 de queimadura por round',
        'O usuario posiciona papeis bomba em varios pontos e em kunais. Quando o inimigo avanca ou e atingido, ocorre a detonacao com impacto e queimadura progressiva, gastando pouco chakra.',
        150
    );
}
