const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/users");
const config = require("../config");

exports.register = async (req, res) => {
    const { username, password } = req.body;
    if (User.find(username))
        return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    new User(username, hashed).save();
    res.json({ message: "User registered" });
};

exports.login = async (req, res) => {
    const { username, password } = req.body;
    const user = User.find(username);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ username }, config.jwtSecret, {
        expiresIn: config.jwtExpires,
    });

    res.json({ token });
};

exports.me = (req, res) => {
    res.json(req.user);
};
