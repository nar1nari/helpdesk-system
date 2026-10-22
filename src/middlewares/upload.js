const crypto = require("node:crypto");
const path = require("node:path");
const multer = require("multer");
const config = require("../config");
const { badRequest } = require("../errors");

const ALLOWED = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".log": "text/plain",
};

const storage = multer.diskStorage({
    destination: config.uploadDir,
    filename: (req, file, cb) =>
        cb(
            null,
            crypto.randomUUID() + path.extname(file.originalname).toLowerCase(),
        ),
});

module.exports = multer({
    storage,
    limits: { fileSize: config.uploadMaxBytes, files: 1, fields: 0 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED[ext])
            return cb(
                badRequest(`File type ${ext || "(none)"} is not allowed`),
            );
        file.mimetype = ALLOWED[ext];
        cb(null, true);
    },
}).single("file");
