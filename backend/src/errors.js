class AppError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
module.exports = {
    AppError,
    badRequest: (m, d) => new AppError(400, m, d),
    unauthorized: (m = "Authentication required") => new AppError(401, m),
    forbidden: (m = "Forbidden") => new AppError(403, m),
    notFound: (m = "Not found") => new AppError(404, m),
    conflict: (m) => new AppError(409, m),
};
