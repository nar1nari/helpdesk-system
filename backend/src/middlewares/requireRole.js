const { forbidden, unauthorized } = require("../errors");

module.exports =
    (...roles) =>
    (req, res, next) =>
        next(
            !req.user
                ? unauthorized()
                : roles.includes(req.user.role)
                  ? undefined
                  : forbidden(),
        );
