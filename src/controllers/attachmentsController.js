const fs = require("node:fs/promises");
const Attachment = require("../models/attachments");
const Request = require("../models/requests");
const { notFound, badRequest } = require("../errors");
const { canView } = require("../policies/requestPolicy");

function toPublic(attachment) {
    const {
        id,
        request_id,
        original_name,
        mime_type,
        size_bytes,
        uploaded_at,
    } = attachment;

    return {
        id,
        request_id,
        original_name,
        mime_type,
        size_bytes,
        uploaded_at,
    };
}

exports.create = async (req, res) => {
    if (!req.file) {
        throw badRequest("No file uploaded");
    }

    try {
        const attachment = await Attachment.create(req.request.id, req.file);

        res.status(201).json({ attachment: toPublic(attachment) });
    } catch (err) {
        await fs.unlink(req.file.path).catch(() => {});
        throw err;
    }
};

exports.listForRequest = async (req, res) => {
    const attachments = await Attachment.listForRequest(req.request.id);

    res.json({
        attachments: attachments.map(toPublic),
    });
};

exports.get = async (req, res) => {
    const attachment = await Attachment.get(req.params.id);
    const request = await Request.get(attachment?.request_id);

    if (!attachment || !canView(req.user, request)) {
        throw notFound("Attachment not found");
    }

    res.download(attachment.absolute_path, attachment.original_name);
};
