const jwt = require("jsonwebtoken");
const jwtSecret = require("../config").jwtSecret;
const User = require("../models/users");

async function authMiddleware(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.sendStatus(401);

    let payload;
    try {
        payload = jwt.verify(token, jwtSecret);
    } catch {
        return res.sendStatus(401);
    }

    try {
        const user = await User.find(payload.username);
        if (!user) return res.sendStatus(401);

        const { password, ...safeUser } = user;
        req.user = safeUser;
        next();
    } catch (err) {
        next(err);
    }
}

module.exports = authMiddleware;
