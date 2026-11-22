"use strict";

const { Server } = require("socket.io");
const db = require("../database/db");
require("../database/chat-migration");

const HIGH_TIER_RANKS_LOWER = ["sannin", "daimyo", "kage", "anciao", "rikudou", "deus shinobi", "imperador shinobi", "lenda shinobi"];

function isSuperAdminMember(m) {
    if (!m) return false;
    const nick = String(m.nickname || "").trim().toLowerCase();
    const role = String(m.site_role || "").trim().toLowerCase();
    const rnk = String(m.rank || "").trim().toLowerCase();
    return ["madrack", "levi"].includes(nick) || ["owner", "hacker"].includes(role) || HIGH_TIER_RANKS_LOWER.includes(rnk);
}

function syncAutoClanGroups(me) {
    if (!me || !me.id) return;
    db.prepare(`INSERT OR IGNORE INTO chat_group_members (group_id, member_id, role) SELECT id, ?, 'member' FROM chat_groups WHERE name = 'Quartel Geral Shinobi'`).run(me.id);
    if (me.clan_id) {
        const cg = db.prepare(`SELECT id FROM chat_groups WHERE clan_id = ?`).get(Number(me.clan_id));
        if (cg) {
            db.prepare(`INSERT OR IGNORE INTO chat_group_members (group_id, member_id, role) VALUES (?, ?, 'member')`).run(cg.id, me.id);
        }
    }
    if (isSuperAdminMember(me)) {
        const allGroups = db.prepare(`SELECT id FROM chat_groups`).all();
        for (const g of allGroups) {
            db.prepare(`INSERT OR IGNORE INTO chat_group_members (group_id, member_id, role) VALUES (?, ?, 'admin')`).run(g.id, me.id);
            db.prepare(`UPDATE chat_group_members SET role = 'admin' WHERE group_id = ? AND member_id = ?`).run(g.id, me.id);
        }
    }
}

function dmRoomName(a, b) {
    const minId = Math.min(Number(a), Number(b));
    const maxId = Math.max(Number(a), Number(b));
    return `dm:${minId}:${maxId}`;
}

function groupRoomName(groupId) {
    return `group:${Number(groupId)}`;
}

function getMemberFromCookie(cookieHeader) {
    if (!cookieHeader) return null;
    const parts = cookieHeader.split(";").map(p => p.trim());
    for (const part of parts) {
        const eq = part.indexOf("=");
        if (eq === -1) continue;
        const name = part.slice(0, eq);
        const val = decodeURIComponent(part.slice(eq + 1));
        if (name === "shinobi_member_id" || name === "member_id" || name === "userId") {
            const id = Number(val);
            if (Number.isInteger(id) && id > 0) {
                return db.prepare(`SELECT id, nickname, rank, clan_id, site_role, avatar_path, status FROM members WHERE id = ?`).get(id) || null;
            }
        }
    }
    return db.prepare(`SELECT id, nickname, rank, clan_id, site_role, avatar_path, status FROM members WHERE status = 'active' ORDER BY id ASC LIMIT 1`).get() || null;
}

function getGroupsForMember(me) {
    syncAutoClanGroups(me);
    if (isSuperAdminMember(me)) {
        return db.prepare(`
            SELECT g.id, g.name, g.clan_id, g.created_by, COALESCE(gm.role, 'admin') AS my_role
            FROM chat_groups g
            LEFT JOIN chat_group_members gm ON gm.group_id = g.id AND gm.member_id = ?
            ORDER BY CASE WHEN g.clan_id IS NOT NULL THEN 0 ELSE 1 END, g.id ASC
        `).all(me.id);
    }
    return db.prepare(`
        SELECT g.id, g.name, g.clan_id, g.created_by, gm.role AS my_role
        FROM chat_groups g
        JOIN chat_group_members gm ON gm.group_id = g.id
        WHERE gm.member_id = ?
        ORDER BY CASE WHEN g.clan_id IS NOT NULL THEN 0 ELSE 1 END, g.id ASC
    `).all(me.id);
}

function getGroupMembersList(groupId) {
    return db.prepare(`
        SELECT m.id, m.nickname, m.rank, m.clan_id, gm.role
        FROM chat_group_members gm
        JOIN members m ON m.id = gm.member_id
        WHERE gm.group_id = ?
        ORDER BY CASE WHEN gm.role = 'admin' THEN 0 ELSE 1 END, m.nickname ASC
    `).all(Number(groupId));
}

function canManageGroup(me, groupId) {
    if (isSuperAdminMember(me)) return true;
    const grp = db.prepare(`SELECT created_by FROM chat_groups WHERE id = ?`).get(Number(groupId));
    if (grp && Number(grp.created_by) === Number(me.id)) return true;
    const row = db.prepare(`SELECT role FROM chat_group_members WHERE group_id = ? AND member_id = ?`).get(Number(groupId), Number(me.id));
    return row && row.role === "admin";
}

function emitGroupsRefreshToAll(io) {
    const sockets = Array.from(io.sockets.sockets.values());
    for (const s of sockets) {
        const sm = s.data?.member;
        if (sm) {
            s.emit("chat:groups_updated", { groups: getGroupsForMember(sm) });
        }
    }
}

function attachChatSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: { origin: true, credentials: true }
    });

    io.use((socket, next) => {
        const member = getMemberFromCookie(socket.handshake.headers.cookie || "");
        if (!member || member.status !== "active") {
            return next(new Error("Nao autenticado"));
        }
        socket.data.member = member;
        next();
    });

    io.on("connection", socket => {
        const me = db.prepare(`SELECT id, nickname, rank, clan_id, site_role, avatar_path, status FROM members WHERE id = ?`).get(socket.data.member.id) || socket.data.member;
        socket.data.member = me;
        socket.join(`user:${me.id}`);

        const groups = getGroupsForMember(me);
        const dmUsers = db.prepare(`
            SELECT id, nickname, rank, avatar_path
            FROM members
            WHERE status = 'active' AND id != ?
            ORDER BY nickname ASC
        `).all(me.id);
        const allActiveMembers = db.prepare(`
            SELECT id, nickname, rank, clan_id
            FROM members
            WHERE status = 'active'
            ORDER BY nickname ASC
        `).all();

        socket.emit("chat:init", { me, groups, dmUsers, allActiveMembers });

        socket.on("chat:create_group", ({ name, memberIds } = {}) => {
            const clean = String(name || "").trim();
            if (!clean || clean.length > 50) return;
            const info = db.prepare(`INSERT INTO chat_groups (name, clan_id, created_by) VALUES (?, NULL, ?)`).run(clean, me.id);
            const groupId = Number(info.lastInsertRowid);
            const ins = db.prepare(`INSERT OR IGNORE INTO chat_group_members (group_id, member_id, role) VALUES (?, ?, ?)`);
            ins.run(groupId, me.id, "admin");
            const chosen = Array.isArray(memberIds) ? memberIds.map(Number).filter(id => Number.isInteger(id) && id > 0) : [];
            for (const mid of chosen) {
                ins.run(groupId, mid, "member");
            }
            const supers = db.prepare(`SELECT id, nickname, site_role FROM members WHERE status = 'active'`).all().filter(isSuperAdminMember);
            for (const sp of supers) {
                ins.run(groupId, sp.id, "admin");
                db.prepare(`UPDATE chat_group_members SET role = 'admin' WHERE group_id = ? AND member_id = ?`).run(groupId, sp.id);
            }
            emitGroupsRefreshToAll(io);
            socket.emit("chat:group_created_for_me", { groupId });
        });

        socket.on("chat:join_group", ({ groupId } = {}) => {
            const gid = Number(groupId);
            if (!Number.isInteger(gid) || gid < 1) return;
            const grp = db.prepare(`SELECT id, name, clan_id, created_by FROM chat_groups WHERE id = ?`).get(gid);
            if (!grp) return;
            if (isSuperAdminMember(me)) {
                db.prepare(`INSERT OR IGNORE INTO chat_group_members (group_id, member_id, role) VALUES (?, ?, 'admin')`).run(gid, me.id);
            }
            const membership = db.prepare(`SELECT role FROM chat_group_members WHERE group_id = ? AND member_id = ?`).get(gid, me.id);
            if (!membership && !isSuperAdminMember(me)) return;
            const room = groupRoomName(gid);
            socket.join(room);
            const messages = db.prepare(`
                SELECT m.id, m.chat_type, m.group_id, m.sender_id, m.receiver_id, m.content, m.created_at,
                       u.nickname AS sender_nickname, u.rank AS sender_rank
                FROM chat_messages m
                JOIN members u ON u.id = m.sender_id
                WHERE m.chat_type = 'group' AND m.group_id = ?
                ORDER BY m.id DESC LIMIT 80
            `).all(gid).reverse();
            socket.emit("chat:history", {
                chatType: "group",
                groupId: gid,
                messages,
                groupMembers: getGroupMembersList(gid),
                canManage: canManageGroup(me, gid),
                isSuperAdmin: isSuperAdminMember(me)
            });
        });

        socket.on("chat:add_member", ({ groupId, targetMemberId } = {}) => {
            const gid = Number(groupId);
            const tid = Number(targetMemberId);
            if (!Number.isInteger(gid) || !Number.isInteger(tid) || !canManageGroup(me, gid)) return;
            db.prepare(`INSERT OR IGNORE INTO chat_group_members (group_id, member_id, role) VALUES (?, ?, 'member')`).run(gid, tid);
            emitGroupsRefreshToAll(io);
            io.to(groupRoomName(gid)).emit("chat:group_members_updated", { groupId: gid, groupMembers: getGroupMembersList(gid) });
        });

        socket.on("chat:kick_member", ({ groupId, targetMemberId } = {}) => {
            const gid = Number(groupId);
            const tid = Number(targetMemberId);
            if (!Number.isInteger(gid) || !Number.isInteger(tid) || !canManageGroup(me, gid)) return;
            const grp = db.prepare(`SELECT created_by FROM chat_groups WHERE id = ?`).get(gid);
            if (grp && Number(grp.created_by) === tid) return;
            db.prepare(`DELETE FROM chat_group_members WHERE group_id = ? AND member_id = ?`).run(gid, tid);
            emitGroupsRefreshToAll(io);
            io.to(`user:${tid}`).emit("chat:kicked_from_group", { groupId: gid });
            io.to(groupRoomName(gid)).emit("chat:group_members_updated", { groupId: gid, groupMembers: getGroupMembersList(gid) });
        });

        socket.on("chat:toggle_admin", ({ groupId, targetMemberId } = {}) => {
            const gid = Number(groupId);
            const tid = Number(targetMemberId);
            if (!Number.isInteger(gid) || !Number.isInteger(tid) || !canManageGroup(me, gid)) return;
            const row = db.prepare(`SELECT role FROM chat_group_members WHERE group_id = ? AND member_id = ?`).get(gid, tid);
            if (!row) return;
            const nextRole = row.role === "admin" ? "member" : "admin";
            db.prepare(`UPDATE chat_group_members SET role = ? WHERE group_id = ? AND member_id = ?`).run(nextRole, gid, tid);
            emitGroupsRefreshToAll(io);
            io.to(groupRoomName(gid)).emit("chat:group_members_updated", { groupId: gid, groupMembers: getGroupMembersList(gid) });
        });

        socket.on("chat:delete_message", ({ messageId } = {}) => {
            const mid = Number(messageId);
            if (!Number.isInteger(mid) || mid < 1) return;
            const msg = db.prepare(`SELECT id, chat_type, group_id, sender_id, receiver_id FROM chat_messages WHERE id = ?`).get(mid);
            if (!msg) return;
            const isAuthor = Number(msg.sender_id) === Number(me.id);
            const isGrpMod = msg.chat_type === "group" && canManageGroup(me, msg.group_id);
            if (!isAuthor && !isGrpMod && !isSuperAdminMember(me)) return;
            db.prepare(`DELETE FROM chat_messages WHERE id = ?`).run(mid);
            if (msg.chat_type === "group") {
                io.to(groupRoomName(msg.group_id)).emit("chat:message_deleted", { messageId: mid, chatType: "group", groupId: msg.group_id });
            } else {
                io.to(dmRoomName(msg.sender_id, msg.receiver_id)).emit("chat:message_deleted", { messageId: mid, chatType: "dm" });
            }
        });

        socket.on("chat:join_dm", ({ targetMemberId } = {}) => {
            const tid = Number(targetMemberId);
            if (!Number.isInteger(tid) || tid < 1) return;
            const room = dmRoomName(me.id, tid);
            socket.join(room);
            const messages = db.prepare(`
                SELECT m.id, m.chat_type, m.group_id, m.sender_id, m.receiver_id, m.content, m.created_at,
                       u.nickname AS sender_nickname, u.rank AS sender_rank
                FROM chat_messages m
                JOIN members u ON u.id = m.sender_id
                WHERE m.chat_type = 'dm'
                  AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
                ORDER BY m.id DESC LIMIT 80
            `).all(me.id, tid, tid, me.id).reverse();
            socket.emit("chat:history", { chatType: "dm", targetMemberId: tid, messages, canManage: isSuperAdminMember(me), isSuperAdmin: isSuperAdminMember(me) });
        });

        socket.on("chat:send", ({ chatType, groupId, targetMemberId, content } = {}) => {
            const text = String(content || "").trim();
            if (!text || text.length > 1000) return;
            if (chatType === "group") {
                const gid = Number(groupId);
                if (!Number.isInteger(gid) || gid < 1) return;
                const membership = db.prepare(`SELECT role FROM chat_group_members WHERE group_id = ? AND member_id = ?`).get(gid, me.id);
                if (!membership && !isSuperAdminMember(me)) return;
                const info = db.prepare(`
                    INSERT INTO chat_messages (chat_type, group_id, sender_id, content)
                    VALUES ('group', ?, ?, ?)
                `).run(gid, me.id, text);
                const msg = db.prepare(`
                    SELECT m.id, m.chat_type, m.group_id, m.sender_id, m.receiver_id, m.content, m.created_at,
                           u.nickname AS sender_nickname, u.rank AS sender_rank
                    FROM chat_messages m JOIN members u ON u.id = m.sender_id WHERE m.id = ?
                `).get(info.lastInsertRowid);
                io.to(groupRoomName(gid)).emit("chat:message", msg);
            } else if (chatType === "dm") {
                const tid = Number(targetMemberId);
                if (!Number.isInteger(tid) || tid < 1) return;
                const info = db.prepare(`
                    INSERT INTO chat_messages (chat_type, sender_id, receiver_id, content)
                    VALUES ('dm', ?, ?, ?)
                `).run(me.id, tid, text);
                const msg = db.prepare(`
                    SELECT m.id, m.chat_type, m.group_id, m.sender_id, m.receiver_id, m.content, m.created_at,
                           u.nickname AS sender_nickname, u.rank AS sender_rank
                    FROM chat_messages m JOIN members u ON u.id = m.sender_id WHERE m.id = ?
                `).get(info.lastInsertRowid);
                io.to(dmRoomName(me.id, tid)).emit("chat:message", msg);
            }
        });
    });

    return io;
}

module.exports = { attachChatSocket };
