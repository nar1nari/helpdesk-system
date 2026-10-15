const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/users");
const config = require("../config");
const { unauthorized } = require("../errors");
const { createUser } = require("../services/userService");

exports.register = async (req, res) => {
    let user = await createUser(req.body);
    res.status(201).json({ user: user });
};

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", config.bcryptRounds);

exports.login = async (req, res) => {
    const { username, password } = req.body;
    const user = await User.find(username);
    const ok = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
    if (!user || !ok || !user.is_active)
        throw unauthorized("Invalid credentials");

    const token = jwt.sign(
        { sub: user.id, role: user.role },
        config.jwtSecret,
        {
            algorithm: "HS256",
            expiresIn: config.jwtExpires,
        },
    );
    res.json({ token });
};

exports.me = (req, res) => {
    res.json(req.user);
};
