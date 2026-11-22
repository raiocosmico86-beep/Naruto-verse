'use strict';

const db = require('./db');

const columns = db.prepare('PRAGMA table_info(members)').all();
const hasAvatarPath = columns.some(column => column.name === 'avatar_path');

if (!hasAvatarPath) {
    db.exec('ALTER TABLE members ADD COLUMN avatar_path TEXT');
    console.log('[DATABASE] Coluna avatar_path adicionada.');
} else {
    console.log('[DATABASE] Coluna avatar_path já existe.');
}
