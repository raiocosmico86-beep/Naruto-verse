'use strict';

const db = require('./db');

db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        content TEXT,
        image_path TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        CHECK (
            (content IS NOT NULL AND length(trim(content)) > 0)
            OR image_path IS NOT NULL
        )
    );

    CREATE TABLE IF NOT EXISTS post_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        UNIQUE (post_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS post_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 500),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_posts_created
        ON posts(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_posts_member
        ON posts(member_id);

    CREATE INDEX IF NOT EXISTS idx_post_likes_post
        ON post_likes(post_id);

    CREATE INDEX IF NOT EXISTS idx_post_comments_post
        ON post_comments(post_id, created_at);
`);

console.log('[FEED] Tabelas de publicações, gostos e comentários prontas.');
