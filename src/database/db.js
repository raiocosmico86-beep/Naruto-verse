'use strict';

const Database = require('better-sqlite3');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'shinobiverse.sqlite');

// Inicializar conexão
const db = new Database(DB_PATH);

// Configurações de desempenho e integridade
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');

// Criar estrutura inicial
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,

        password_hash TEXT NOT NULL,

        role TEXT NOT NULL DEFAULT 'shinobi'
            CHECK (role IN ('shinobi', 'admin')),

        status TEXT NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'suspended')),

        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CHECK (length(username) BETWEEN 3 AND 24),
        CHECK (length(email) BETWEEN 5 AND 254)
    );

    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        user_id INTEGER NOT NULL,

        token_hash TEXT NOT NULL UNIQUE,

        expires_at INTEGER NOT NULL,

        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user
        ON sessions(user_id);

    CREATE INDEX IF NOT EXISTS idx_sessions_expiration
        ON sessions(expires_at);
`);

console.log('[DATABASE] SHINOBIVERSE DATABASE INITIALIZED');

module.exports = db;
