const jwt = require("jsonwebtoken");
const config = require("../config");
const User = require("../models/users");
const { unauthorized } = require("../errors");

async function authMiddleware(req, res, next) {
    const match = /^Bearer (.+)$/i.exec(req.headers.authorization ?? "");
    if (!match) throw unauthorized();

    let payload;
    try {
        payload = jwt.verify(match[1], config.jwtSecret, {
            algorithms: ["HS256"],
        });
    } catch {
        throw unauthorized("Invalid or expired token");
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.is_active) throw unauthorized();
    req.user = user;
    next();
}

module.exports = authMiddleware;
