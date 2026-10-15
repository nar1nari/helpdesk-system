const { badRequest } = require("../errors");

module.exports = (schemas) => (req, res, next) => {
    for (const part of ["params", "query", "body"]) {
        if (!schemas[part]) continue;
        const result = schemas[part].safeParse(req[part] ?? {});
        if (!result.success) {
            return next(
                badRequest(
                    "Validation failed",
                    result.error.issues.map((i) => ({
                        path: i.path.join("."),
                        message: i.message,
                    })),
                ),
            );
        }
        Object.defineProperty(req, part, {
            value: result.data,
            writable: true,
            configurable: true,
        });
    }
    next();
};
