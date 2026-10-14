const bcrypt = require("bcryptjs");
const User = require("../models/users");
const StatusHistory = require("../models/statusHistory");

exports.createUser = async (req, res) => {
    if (!req.user || req.user.role !== User.Role.ADMIN) {
        return res.status(403).json({ message: "Forbidden" });
    }
    const { username, password } = req.body;
    if (await User.find(username))
        return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    await User.create(username, hashed);
    res.json({ message: "User registered" });
};

exports.getStatusHistory = async (req, res) => {
    if (!req.user || req.user.role !== User.Role.ADMIN) {
        return res.status(403).json({ message: "Forbidden" });
    }
    const { requestId } = req.params;
    const statusHistory = await StatusHistory.getBy(requestId);
    res.json({ status_history: statusHistory });
};

exports.deleteUser = async (req, res) => {
    if (!req.user || req.user.role !== User.Role.ADMIN) {
        return res.status(403).json({ message: "Forbidden" });
    }
    const { username } = req.params;
    const deleted = await User.delete(username);
    res.json({ user: deleted });
};
