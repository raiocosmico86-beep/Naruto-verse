'use strict';

const db = require('../database/db');
require('../database/feed-migration');

function listPosts(memberId) {
    const posts = db.prepare(`
        SELECT
            posts.id,
            posts.member_id,
            posts.content,
            posts.image_path,
            posts.created_at,
            posts.updated_at,
            members.nickname,
            members.avatar_path,
            members.rank,
            clans.name AS clan,
            (SELECT COUNT(*) FROM post_likes
                WHERE post_likes.post_id = posts.id) AS likes_count,
            EXISTS (
                SELECT 1 FROM post_likes
                WHERE post_likes.post_id = posts.id
                AND post_likes.member_id = ?
            ) AS liked_by_me
        FROM posts
        INNER JOIN members ON members.id = posts.member_id
        LEFT JOIN clans ON clans.id = members.clan_id
        ORDER BY posts.created_at DESC, posts.id DESC
        LIMIT 50
    `).all(memberId);

    if (posts.length === 0) return [];

    const ids = posts.map(post => post.id);
    const placeholders = ids.map(() => '?').join(',');

    const comments = db.prepare(`
        SELECT
            post_comments.id,
            post_comments.post_id,
            post_comments.member_id,
            post_comments.content,
            post_comments.created_at,
            members.nickname,
            members.avatar_path,
            members.rank
        FROM post_comments
        INNER JOIN members ON members.id = post_comments.member_id
        WHERE post_comments.post_id IN (${placeholders})
        ORDER BY post_comments.created_at ASC, post_comments.id ASC
    `).all(...ids);

    const commentsByPost = new Map();

    for (const comment of comments) {
        if (!commentsByPost.has(comment.post_id)) {
            commentsByPost.set(comment.post_id, []);
        }
        commentsByPost.get(comment.post_id).push(comment);
    }

    return posts.map(post => ({
        ...post,
        comments: commentsByPost.get(post.id) || []
    }));
}

function findPostById(postId) {
    return db.prepare(`
        SELECT id, member_id, content, image_path
        FROM posts
        WHERE id = ?
    `).get(postId) || null;
}

function createPost(memberId, content, imagePath) {
    const result = db.prepare(`
        INSERT INTO posts (member_id, content, image_path)
        VALUES (?, ?, ?)
    `).run(memberId, content || null, imagePath || null);

    return findPostById(result.lastInsertRowid);
}

function updatePost(postId, content) {
    db.prepare(`
        UPDATE posts
        SET content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(content || null, postId);

    return findPostById(postId);
}

function deletePost(postId) {
    const post = findPostById(postId);
    if (!post) return null;

    db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
    return post;
}

function toggleLike(postId, memberId) {
    const existing = db.prepare(`
        SELECT id FROM post_likes
        WHERE post_id = ? AND member_id = ?
    `).get(postId, memberId);

    if (existing) {
        db.prepare('DELETE FROM post_likes WHERE id = ?').run(existing.id);
        return false;
    }

    db.prepare(`
        INSERT INTO post_likes (post_id, member_id)
        VALUES (?, ?)
    `).run(postId, memberId);

    return true;
}

function createComment(postId, memberId, content) {
    const result = db.prepare(`
        INSERT INTO post_comments (post_id, member_id, content)
        VALUES (?, ?, ?)
    `).run(postId, memberId, content);

    return db.prepare(`
        SELECT
            post_comments.id,
            post_comments.post_id,
            post_comments.member_id,
            post_comments.content,
            post_comments.created_at,
            members.nickname,
            members.avatar_path,
            members.rank
        FROM post_comments
        INNER JOIN members ON members.id = post_comments.member_id
        WHERE post_comments.id = ?
    `).get(result.lastInsertRowid);
}

function findCommentById(commentId) {
    return db.prepare(`
        SELECT id, post_id, member_id
        FROM post_comments
        WHERE id = ?
    `).get(commentId) || null;
}

function deleteComment(commentId) {
    return db.prepare(`
        DELETE FROM post_comments WHERE id = ?
    `).run(commentId).changes === 1;
}

module.exports = {
    listPosts,
    findPostById,
    createPost,
    updatePost,
    deletePost,
    toggleLike,
    createComment,
    findCommentById,
    deleteComment
};
