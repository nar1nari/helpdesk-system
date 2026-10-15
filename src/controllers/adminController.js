const { createUser } = require("../services/userService");
const StatusHistory = require("../models/statusHistory");
const { badRequest, forbidden } = require("../errors");

exports.createUser = async (req, res) => {
    let user = await createUser(req.body);
    res.status(201).json({ user: user });
};

exports.listUsers = async (req, res) => {
    res.json({ users: await User.all() });
};

exports.updateUser = async (req, res) => {
    res.json({ user: await User.update(req.params.id, req.body) });
};

exports.getStatusHistory = async (req, res) => {
    const { requestId } = req.params;
    const statusHistory = await StatusHistory.getBy(requestId);
    res.json({ status_history: statusHistory });
};
