const fs = require("node:fs/promises");
const Attachment = require("../models/attachments");
const Request = require("../models/requests");
const { notFound, forbidden, badRequest } = require("../errors");

function canView(user, request) {
    if (user.role === "admin") return true;
    if (user.role === "operator") return true;
    if (user.role === "applicant") return request.user_id === user.id;
}

exports.create = async (req, res) => {
    try {
        const request = await Request.get(req.params.id);

        if (!request) {
            throw notFound("Request not found");
        }

        if (request.user_id !== req.user.id) {
            throw forbidden();
        }

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

    const request = await Request.get(attachment.request_id);

    if (!canView(req.user, request)) {
        throw forbidden();
    }

    res.download(attachment.absolute_path, attachment.original_name);
};
