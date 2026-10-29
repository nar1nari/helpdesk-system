const { conflict, notFound, forbidden } = require("../errors");
const Comment = require("../models/comments");
const notifications = require("../services/notificationService");
const { canDeleteComment } = require("../policies/requestPolicy");

exports.create = async (req, res) => {
    if (["closed", "rejected"].includes(req.request.status)) {
        throw conflict("Request is closed");
    }
    const comment = await Comment.create(
        req.params.id,
        req.user.id,
        req.body.content,
    );
    await notifications.commentAdded(req.request, req.user);
    res.status(201).json({ comment: comment });
};

exports.get = async (req, res) => {
    const comments = await Comment.findBy(req.params.id);
    res.json({ comments: comments });
};

exports.remove = async (req, res) => {
    const comment = await Comment.get(req.params.commentId);
    if (!comment || comment.request_id !== req.request.id) {
        throw notFound("Comment not found");
    }
    if (!canDeleteComment(req.user, comment)) throw forbidden();

    if (!(await Comment.delete(comment.id, req.user.id))) {
        throw notFound("Comment not found");
    }
    await notifications.commentDeleted(req.request, req.user);
    res.status(204).end();
};
