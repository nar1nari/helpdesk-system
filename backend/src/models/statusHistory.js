const db = require("../db");

const StatusHistory = {
    async create(request_id, changed_by_id, old_status, new_status) {
        const { rows } = await db.query(
            `INSERT INTO request_status_history (request_id, changed_by, old_status, new_status)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [request_id, changed_by_id, old_status, new_status],
        );
        return rows[0];
    },

    async getBy(request_id) {
        const { rows } = await db.query(
            `SELECT h.id, h.request_id, h.old_status, h.new_status, h.changed_at,
                    json_build_object('id', u.id, 'username', u.username) AS changed_by
             FROM request_status_history h
             JOIN users u ON u.id = h.changed_by
             WHERE h.request_id = $1
             ORDER BY h.changed_at DESC, h.id DESC`,
            [request_id],
        );
        return rows;
    },
};

module.exports = StatusHistory;
