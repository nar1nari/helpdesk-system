const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");

const db = require("../db");

const uploadDir = path.resolve("uploads/attachments");

const Attachment = {
    async create(request_id, file) {
        await fs.mkdir(uploadDir, { recursive: true });

        const ext = path.extname(file.originalname).toLowerCase();
        const filename = `${crypto.randomUUID()}${ext}`;
        const filePath = path.join(uploadDir, filename);

        await fs.copyFile(file.path, filePath);

        try {
            const { rows } = await db.query(
                `INSERT INTO request_attachments
                    (request_id, file_path, original_name)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [
                    request_id,
                    path.posix.join("attachments", filename),
                    path.basename(file.originalname),
                ],
            );

            return rows[0];
        } catch (err) {
            await fs.unlink(filePath).catch(() => {});
            throw err;
        }
    },

    async get(id) {
        const { rows } = await db.query(
            `SELECT * FROM request_attachments
             WHERE id = $1`,
            [id],
        );

        if (!rows[0]) return null;

        const attachment = rows[0];

        return {
            ...attachment,
            absolute_path: path.join(
                uploadDir,
                path.basename(attachment.file_path),
            ),
        };
    },
};

module.exports = Attachment;
