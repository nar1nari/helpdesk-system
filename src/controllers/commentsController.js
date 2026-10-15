const { notFound, forbidden, badRequest } = require("../errors");
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
        throw notFound("Request not found");
    }

    if (!canView(req.user, request)) {
        throw forbidden();
    }

    if (!req.body?.message) {
        throw badRequest("Message is required");
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
        throw notFound("Request not found");
    }

    if (!canView(req.user, request)) {
        throw forbidden();
    }

    const comments = await Comment.findBy(req.params.id);
    res.json({ comments: comments });
};
