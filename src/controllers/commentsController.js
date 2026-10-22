const { conflict } = require("../errors");
const Comment = require("../models/comments");

exports.create = async (req, res) => {
    if (["closed", "rejected"].includes(req.request.status)) {
        throw conflict("Request is closed");
    }
    const comment = await Comment.create(
        req.params.id,
        req.user.id,
        req.body.content,
    );
    res.status(201).json({ comment: comment });
};

exports.get = async (req, res) => {
    const comments = await Comment.findBy(req.params.id);
    res.json({ comments: comments });
};
