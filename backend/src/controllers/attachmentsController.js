const fs = require("node:fs/promises");
const Attachment = require("../models/attachments");
const RequestModel = require("../models/requests");
const { notFound, badRequest, forbidden } = require("../errors");
const { canView, canDeleteAttachment } = require("../policies/requestPolicy");
const notifications = require("../services/notificationService");

function toPublic(attachment) {
    const {
        id,
        request_id,
        original_name,
        mime_type,
        size_bytes,
        uploaded_at,
        uploaded_by,
    } = attachment;

    return {
        id,
        request_id,
        original_name,
        mime_type,
        size_bytes,
        uploaded_at,
        uploaded_by,
    };
}

exports.create = async (req, res) => {
    if (!req.file) {
        throw badRequest("No file uploaded");
    }

    try {
        const attachment = await Attachment.create(
            req.request.id,
            req.file,
            req.user.id,
        );
        await notifications.fileAdded(
            req.request,
            req.user,
            attachment.original_name,
        );

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
    const request =
        attachment && (await RequestModel.get(attachment.request_id));

    if (!attachment || !request || !canView(req.user, request)) {
        throw notFound("Attachment not found");
    }

    res.download(attachment.absolute_path, attachment.original_name);
};

exports.remove = async (req, res) => {
    const attachment = await Attachment.get(req.params.id);
    const request =
        attachment && (await RequestModel.get(attachment.request_id));

    if (!request || !canView(req.user, request)) {
        throw notFound("Attachment not found");
    }
    if (!canDeleteAttachment(req.user, attachment)) throw forbidden();

    if (!(await Attachment.delete(attachment.id, req.user.id))) {
        throw notFound("Attachment not found");
    }
    await notifications.fileDeleted(
        request,
        req.user,
        attachment.original_name,
    );
    res.status(204).end();
};
