const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/users");
const config = require("../config");

exports.register = async (req, res) => {
    const { username, password } = req.body;
    if (await User.find(username))
        return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    await User.create(username, hashed);
    res.json({ message: "User registered" });
};

exports.login = async (req, res) => {
    const { username, password } = req.body;
    const user = await User.find(username);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
        { id: user.id, username, role: user.role },
        config.jwtSecret,
        {
            expiresIn: config.jwtExpires,
        },
    );

    res.json({ token });
};

exports.me = (req, res) => {
    res.json(req.user);
};
