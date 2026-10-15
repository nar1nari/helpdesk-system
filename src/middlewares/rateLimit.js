const rateLimit = require("express-rate-limit");
const config = require("../config");
const { AppError } = require("../errors");

exports.authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => config.nodeEnv === "test",
    handler: (req, res, next) =>
        next(new AppError(429, "Too many attempts, try again later")),
});
