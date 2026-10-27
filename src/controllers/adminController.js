const { createUser } = require("../services/userService");
const User = require("../models/users");
const { notFound } = require("../errors");

exports.createUser = async (req, res) => {
    let user = await createUser(req.body);
    res.status(201).json({ user: user });
};

exports.listUsers = async (req, res) => {
    res.json({ users: await User.all() });
};

exports.updateUser = async (req, res) => {
    let user = await User.findById(req.params.id);
    if (!user) throw notFound("User not found");
    if (req.body.role !== undefined)
        user = await User.changeRole(req.params.id, req.body.role);
    if (req.body.isActive !== undefined)
        user = await User.changeActive(req.params.id, req.body.isActive);
    res.json({ user: user });
};
