const Comment = require("../models/comments");
const Request = require("../models/requests");

function canView(user, request) {
    if (user.role === "admin") return true;
    if (user.role === "operator") return true;
    if (user.role === "applicant") return request.user_id === user.id;
}

exports.create = async (req, res) => {
    const request = await Request.get(req.params.id);
    if (!request) {
        return res.status(404).json({ message: "Request not found" });
    }

    if (!canView(req.user, request)) {
        return res.status(403).json({ message: "Forbidden" });
    }

    if (!req.body?.message) {
        return res.status(400).json({ message: "No comment uploaded" });
    }

    const comment = await Comment.create(
        req.params.id,
        req.user.id,
        req.body.message,
    );
    res.json({ comment: comment });
};

exports.get = async (req, res) => {
    const request = await Request.get(req.params.id);
    if (!request) {
        return res.status(404).json({ message: "Request not found" });
    }

    if (!canView(req.user, request)) {
        return res.status(403).json({ message: "Forbidden" });
    }

    const comments = await Comment.findBy(req.params.id);
    res.json({ comments: comments });
};
