const fs = require("node:fs/promises");
const Attachment = require("../models/attachments");
const Request = require("../models/requests");
const User = require("../models/users");

function canView(user, request) {
    if (user.role === "admin") return true;
    if (user.role === "operator") return true;
    if (user.role === "applicant") return request.user_id === user.id;
}

exports.create = async (req, res, next) => {
    try {
        const user = await User.find(req.user.username);

        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const request = await Request.get(req.params.id);

        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        if (request.user_id !== user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const attachment = await Attachment.create(request.id, req.file);

        res.status(201).json({ attachment });
    } catch (err) {
        next(err);
    } finally {
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
    }
};

exports.get = async (req, res, next) => {
    const user = await User.find(req.user.username);

    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const attachment = await Attachment.get(req.params.id);

    if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
    }

    const request = await Request.get(attachment.request_id);

    if (!canView(user, request)) {
        return res.status(403).json({ message: "Forbidden" });
    }

    res.download(attachment.absolute_path, attachment.original_name, (err) => {
        if (err && !res.headersSent) {
            next(err);
        }
    });
};
