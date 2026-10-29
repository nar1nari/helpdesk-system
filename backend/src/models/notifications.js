const db = require("../db");

const Type = Object.freeze({
    STATUS_CHANGED: "status_changed",
    COMMENT_ADDED: "comment_added",
    COMMENT_DELETED: "comment_deleted",
    FILE_ADDED: "file_added",
    FILE_DELETED: "file_deleted",
});

const SELECT_NOTIFICATION = `
    SELECT n.id, n.request_id, n.type, n.meta, n.is_read, n.created_at,
           r.title AS request_title,
           CASE WHEN a.id IS NULL THEN NULL
                ELSE json_build_object('id', a.id, 'username', a.username)
           END AS actor
    FROM notifications n
    JOIN requests r ON r.id = n.request_id AND r.deleted_at IS NULL
    LEFT JOIN users a ON a.id = n.actor_id`;

const Notification = {
    Type,

    async createMany(userIds, { requestId, actorId = null, type, meta = {} }) {
        if (!Object.values(Type).includes(type))
            throw new Error(`Unknown notification type: ${type}`);
        if (userIds.length === 0) return 0;

        const { rowCount } = await db.query(
            `INSERT INTO notifications (user_id, request_id, actor_id, type, meta)
             SELECT uid, $2, $3, $4, $5::jsonb
             FROM unnest($1::int[]) AS uid`,
            [userIds, requestId, actorId, type, JSON.stringify(meta)],
        );
        return rowCount;
    },

    async listFor(userId, { unreadOnly = false, page = 1, limit = 20 } = {}) {
        const where = `WHERE n.user_id = $1${unreadOnly ? " AND NOT n.is_read" : ""}`;

        const total = await db.query(
            `SELECT COUNT(*)::int AS total
             FROM notifications n
             JOIN requests r ON r.id = n.request_id AND r.deleted_at IS NULL
             ${where}`,
            [userId],
        );
        const { rows } = await db.query(
            `${SELECT_NOTIFICATION}
             ${where}
             ORDER BY n.created_at DESC, n.id DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, (page - 1) * limit],
        );

        return {
            notifications: rows,
            pagination: {
                page,
                limit,
                total: total.rows[0].total,
                totalPages: Math.ceil(total.rows[0].total / limit),
            },
        };
    },

    async unreadCount(userId) {
        const { rows } = await db.query(
            `SELECT COUNT(*)::int AS count
             FROM notifications n
             JOIN requests r ON r.id = n.request_id AND r.deleted_at IS NULL
             WHERE n.user_id = $1 AND NOT n.is_read`,
            [userId],
        );
        return rows[0].count;
    },

    async markRead(id, userId) {
        const { rows } = await db.query(
            `UPDATE notifications SET is_read = true
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [id, userId],
        );
        if (!rows[0]) return undefined;
        const found = await db.query(`${SELECT_NOTIFICATION} WHERE n.id = $1`, [
            id,
        ]);
        return found.rows[0];
    },

    async markAllRead(userId) {
        const { rowCount } = await db.query(
            `UPDATE notifications SET is_read = true
             WHERE user_id = $1 AND NOT is_read`,
            [userId],
        );
        return rowCount;
    },
};

module.exports = Notification;
