const path = require("node:path");
const db = require("../db");
const config = require("../config");

const Attachment = {
    async create(requestId, file, uploadedBy = null) {
        const originalName = path.basename(file.originalname).slice(-255);

        const { rows } = await db.query(
            `INSERT INTO request_attachments
                (request_id, file_path, original_name,
                 mime_type, size_bytes, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                requestId,
                file.filename,
                originalName,
                file.mimetype,
                file.size,
                uploadedBy,
            ],
        );

        return rows[0];
    },

    async get(id) {
        const { rows } = await db.query(
            `SELECT * FROM request_attachments
             WHERE id = $1 AND deleted_at IS NULL`,
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
                    mime_type, size_bytes, uploaded_at, uploaded_by
             FROM request_attachments
             WHERE request_id = $1 AND deleted_at IS NULL
             ORDER BY uploaded_at ASC, id ASC`,
            [requestId],
        );

        return rows;
    },

    async delete(id, deletedBy = null) {
        const { rows } = await db.query(
            `UPDATE request_attachments
             SET deleted_at = now(), deleted_by = $2
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING *`,
            [id, deletedBy],
        );
        return rows[0];
    },

    async countForRequest(requestId) {
        const { rows } = await db.query(
            `SELECT COUNT(*)::int AS count
             FROM request_attachments
             WHERE request_id = $1 AND deleted_at IS NULL`,
            [requestId],
        );

        return rows[0].count;
    },
};

module.exports = Attachment;
