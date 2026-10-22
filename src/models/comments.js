const db = require("../db");

const Comment = {
    async create(request_id, user_id, text) {
        const { rows } = await db.query(
            `INSERT INTO request_comments (request_id, author_id, content)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [request_id, user_id, text],
        );
        return rows[0];
    },

    async findBy(request_id) {
        const { rows } = await db.query(
            `SELECT *
             FROM request_comments
             WHERE request_id = $1
             ORDER BY created_at ASC, id ASC;`,
            [request_id],
        );
        return rows;
    },

    async delete(id) {
        const { rows } = await db.query(
            `DELETE FROM request_comments WHERE id = $1
            RETURNING *`,
            [id],
        );
        return rows[0];
    },
};

module.exports = Comment;
