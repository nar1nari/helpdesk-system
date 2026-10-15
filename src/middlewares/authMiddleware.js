const jwt = require("jsonwebtoken");
const jwtSecret = require("../config").jwtSecret;
const User = require("../models/users");
const { unauthorized } = require("../errors");

async function authMiddleware(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return next(unauthorized());

    let payload;
    try {
        payload = jwt.verify(token, jwtSecret);
    } catch {
        return next(unauthorized());
    }

    try {
        const user = await User.find(payload.username);
        if (!user) return next(unauthorized());

        const safeUser = { ...user };
        delete safeUser.password;
        req.user = safeUser;
        next();
    } catch (err) {
        next(err);
    }
}

module.exports = authMiddleware;
