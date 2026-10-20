const fs = require("node:fs/promises");
const Attachment = require("../models/attachments");
const Request = require("../models/requests");
const { notFound, badRequest } = require("../errors");

exports.create = async (req, res) => {
    try {
        const request = await Request.get(req.params.id);

        if (!req.file) {
            throw badRequest("No file uploaded");
        }

        const attachment = await Attachment.create(request.id, req.file);

        res.status(201).json({ attachment });
    } finally {
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
    }
};

exports.get = async (req, res) => {
    const attachment = await Attachment.get(req.params.id);

    if (!attachment) {
        throw notFound("Attachment not found");
    }

    res.download(attachment.absolute_path, attachment.original_name);
};
