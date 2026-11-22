"use strict";

const db = require("./db");

db.exec(`
    CREATE TABLE IF NOT EXISTS chat_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        clan_id INTEGER,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_group_members (
        group_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, member_id),
        FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_type TEXT NOT NULL CHECK (chat_type IN ('group', 'dm')),
        group_id INTEGER,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES members(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_group ON chat_messages(group_id, id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_dm ON chat_messages(sender_id, receiver_id, id);
`);

try { db.exec(`ALTER TABLE chat_groups ADD COLUMN clan_id INTEGER`); } catch {}
try { db.exec(`ALTER TABLE chat_group_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'`); } catch {}

const firstMember = db.prepare(`SELECT id FROM members ORDER BY id ASC LIMIT 1`).get();
const defaultCreatorId = firstMember ? Number(firstMember.id) : 1;

let generalGroup = db.prepare(`SELECT id FROM chat_groups WHERE name = ?`).get("Quartel Geral Shinobi");
if (!generalGroup) {
    const info = db.prepare(`INSERT INTO chat_groups (name, clan_id, created_by) VALUES (?, NULL, ?)`).run("Quartel Geral Shinobi", defaultCreatorId);
    generalGroup = { id: Number(info.lastInsertRowid) };
}

const activeMembers = db.prepare(`SELECT id, clan_id, nickname, site_role FROM members WHERE status = 'active'`).all();
const insGeneral = db.prepare(`INSERT OR IGNORE INTO chat_group_members (group_id, member_id, role) VALUES (?, ?, 'member')`);
for (const m of activeMembers) {
    const isSuper = ["madrack", "levi"].includes(String(m.nickname || "").trim().toLowerCase()) || ["owner", "hacker"].includes(String(m.site_role || ""));
    insGeneral.run(generalGroup.id, m.id);
    if (isSuper) {
        db.prepare(`UPDATE chat_group_members SET role = 'admin' WHERE group_id = ? AND member_id = ?`).run(generalGroup.id, m.id);
    }
}

const clans = db.prepare(`SELECT id, name FROM clans ORDER BY id ASC`).all();
const insClanMember = db.prepare(`INSERT OR IGNORE INTO chat_group_members (group_id, member_id, role) VALUES (?, ?, 'member')`);
for (const clan of clans) {
    const groupName = `Clã ${clan.name}`;
    let cGroup = db.prepare(`SELECT id FROM chat_groups WHERE clan_id = ?`).get(clan.id);
    if (!cGroup) {
        cGroup = db.prepare(`SELECT id FROM chat_groups WHERE name = ?`).get(groupName);
    }
    if (!cGroup) {
        const info = db.prepare(`INSERT INTO chat_groups (name, clan_id, created_by) VALUES (?, ?, ?)`).run(groupName, clan.id, defaultCreatorId);
        cGroup = { id: Number(info.lastInsertRowid) };
    } else {
        db.prepare(`UPDATE chat_groups SET clan_id = ?, name = ? WHERE id = ?`).run(clan.id, groupName, cGroup.id);
    }
    for (const m of activeMembers) {
        const isSuper = ["madrack", "levi"].includes(String(m.nickname || "").trim().toLowerCase()) || ["owner", "hacker"].includes(String(m.site_role || ""));
        if (Number(m.clan_id) === Number(clan.id) || isSuper) {
            insClanMember.run(cGroup.id, m.id);
            if (isSuper) {
                db.prepare(`UPDATE chat_group_members SET role = 'admin' WHERE group_id = ? AND member_id = ?`).run(cGroup.id, m.id);
            }
        }
    }
}
