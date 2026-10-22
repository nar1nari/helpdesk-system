const path = require("node:path");
const db = require("../db");
const config = require("../config");

const Attachment = {
    async create(requestId, file) {
        const originalName = path.basename(file.originalname).slice(-255);

        const { rows } = await db.query(
            `INSERT INTO request_attachments
                (request_id, file_path, original_name,
                 mime_type, size_bytes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [requestId, file.filename, originalName, file.mimetype, file.size],
        );

        return rows[0];
    },

    async get(id) {
        const { rows } = await db.query(
            `SELECT * FROM request_attachments
             WHERE id = $1`,
            [id],
        );

        if (!rows[0]) return null;

        return {
            ...rows[0],
            absolute_path: path.join(
                config.uploadDir,
                path.basename(rows[0].file_path),
            ),
        };
    },

    async listForRequest(requestId) {
        const { rows } = await db.query(
            `SELECT id, request_id, original_name,
                    mime_type, size_bytes, uploaded_at
             FROM request_attachments
             WHERE request_id = $1
             ORDER BY uploaded_at ASC, id ASC`,
            [requestId],
        );

        return rows;
    },

    async countForRequest(requestId) {
        const { rows } = await db.query(
            `SELECT COUNT(*)::int AS count
             FROM request_attachments
             WHERE request_id = $1`,
            [requestId],
        );

        return rows[0].count;
    },
};

module.exports = Attachment;
