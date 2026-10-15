const db = require("../db");
const Status = require("./status");
const { badRequest } = require("../errors");

const StatusHistory = {
    Status,

    async create(request_id, changed_by_id, old_status, new_status) {
        if (!Object.values(StatusHistory.Status).includes(new_status)) {
            throw badRequest("Invalid status", new_status);
        }
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
            `SELECT * FROM request_status_history WHERE request_id = $1
            ORDER BY changed_at DESC`,
            [request_id],
        );
        return rows;
    },
};

module.exports = StatusHistory;
