'use strict';

const db = require('./db');

const columns = db.prepare(`
    PRAGMA table_info(members)
`).all();

const columnNames = columns.map(column => column.name);

if (!columnNames.includes('wins')) {
    db.exec(`
        ALTER TABLE members
        ADD COLUMN wins INTEGER NOT NULL DEFAULT 0
        CHECK (wins >= 0)
    `);
}

if (!columnNames.includes('losses')) {
    db.exec(`
        ALTER TABLE members
        ADD COLUMN losses INTEGER NOT NULL DEFAULT 0
        CHECK (losses >= 0)
    `);
}

console.log('[RANKING] Estatísticas de vitórias e derrotas prontas.');
