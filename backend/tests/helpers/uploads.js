const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const config = require("../../src/config");
const Attachment = require("../../src/models/attachments");

function cleanupUploads() {
    let before;
    beforeAll(async () => {
        await fs.mkdir(config.uploadDir, { recursive: true });
        before = new Set(await fs.readdir(config.uploadDir));
    });
    afterAll(async () => {
        for (const name of await fs.readdir(config.uploadDir)) {
            if (!before.has(name))
                await fs.rm(path.join(config.uploadDir, name), { force: true });
        }
    });
}

async function addAttachment(
    requestId,
    { name = "report.txt", content = "hello world", uploadedBy = null } = {},
) {
    const filename = `${crypto.randomUUID()}${path.extname(name)}`;
    await fs.writeFile(path.join(config.uploadDir, filename), content);
    return Attachment.create(
        requestId,
        {
            filename,
            originalname: name,
            mimetype: "text/plain",
            size: Buffer.byteLength(content),
        },
        uploadedBy,
    );
}

const fileExists = (attachment) =>
    fs
        .access(
            attachment.absolute_path ??
                path.join(config.uploadDir, attachment.file_path),
        )
        .then(() => true)
        .catch(() => false);

module.exports = { cleanupUploads, addAttachment, fileExists };
