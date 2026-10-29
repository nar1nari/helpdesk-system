const db = require("../db");

const SELECT_COMMENT = `
    SELECT cm.id, cm.request_id, cm.content, cm.created_at,
           json_build_object('id', u.id, 'username', u.username) AS author
    FROM request_comments cm
    JOIN users u ON u.id = cm.author_id`;

const Comment = {
    async create(request_id, user_id, text) {
        const { rows } = await db.query(
            `INSERT INTO request_comments (request_id, author_id, content)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [request_id, user_id, text],
        );
        const created = await db.query(`${SELECT_COMMENT} WHERE cm.id = $1`, [
            rows[0].id,
        ]);
        return created.rows[0];
    },

    async get(id) {
        const { rows } = await db.query(
            `SELECT id, request_id, author_id, content, created_at
             FROM request_comments
             WHERE id = $1 AND deleted_at IS NULL`,
            [id],
        );
        return rows[0];
    },

    async findBy(request_id) {
        const { rows } = await db.query(
            `${SELECT_COMMENT}
             WHERE cm.request_id = $1 AND cm.deleted_at IS NULL
             ORDER BY cm.created_at ASC, cm.id ASC`,
            [request_id],
        );
        return rows;
    },

    async delete(id, deleted_by = null) {
        const { rows } = await db.query(
            `UPDATE request_comments
             SET deleted_at = now(), deleted_by = $2
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING *`,
            [id, deleted_by],
        );
        return rows[0];
    },
};

module.exports = Comment;
