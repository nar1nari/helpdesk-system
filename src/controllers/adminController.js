const { createUser } = require("../services/userService");
const StatusHistory = require("../models/statusHistory");
const User = require("../models/users");

exports.createUser = async (req, res) => {
    let user = await createUser(req.body);
    res.status(201).json({ user: user });
};

exports.listUsers = async (req, res) => {
    res.json({ users: await User.all() });
};

exports.updateUser = async (req, res) => {
    let user = await User.findById(req.params.id);
    if (req.body.role)
        user = await User.changeRole(req.params.id, req.body.role);
    if (req.body.isActive)
        user = await User.changeActive(req.params.id, req.body.isActive);
    res.json({ user: user });
};

exports.getStatusHistory = async (req, res) => {
    const { requestId } = req.params;
    const statusHistory = await StatusHistory.getBy(requestId);
    res.json({ status_history: statusHistory });
};
