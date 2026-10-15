const bcrypt = require("bcryptjs");
const User = require("../models/users");
const StatusHistory = require("../models/statusHistory");
const { badRequest, forbidden } = require("../errors");

exports.createUser = async (req, res) => {
    if (!req.user || req.user.role !== User.Role.ADMIN) {
        throw forbidden();
    }
    const { username, password } = req.body;
    if (await User.find(username))
        throw badRequest("User already exists", username);

    const hashed = await bcrypt.hash(password, 10);
    await User.create(username, hashed);
    res.json({ message: "User registered" });
};

exports.getStatusHistory = async (req, res) => {
    if (!req.user || req.user.role !== User.Role.ADMIN) {
        throw forbidden();
    }
    const { requestId } = req.params;
    const statusHistory = await StatusHistory.getBy(requestId);
    res.json({ status_history: statusHistory });
};

exports.deleteUser = async (req, res) => {
    if (!req.user || req.user.role !== User.Role.ADMIN) {
        throw forbidden();
    }
    const { username } = req.params;
    const deleted = await User.delete(username);
    res.json({ user: deleted });
};
