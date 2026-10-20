const { badRequest } = require("../errors");
const Comment = require("../models/comments");

exports.create = async (req, res) => {
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
    const comments = await Comment.findBy(req.params.id);
    res.json({ comments: comments });
};
