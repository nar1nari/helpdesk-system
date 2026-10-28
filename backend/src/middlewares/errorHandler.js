const PG_ERRORS = {
    "22P02": [400, "Invalid value"],
    22003: [400, "Number out of range"],
    22007: [400, "Invalid date"],
    22008: [400, "Invalid date"],
    22001: [400, "Value too long"],
    23502: [400, "Missing required value"],
    23001: [409, "Referenced record does not exist or is still in use"],
    23503: [409, "Referenced record does not exist or is still in use"],
    23505: [409, "Already exists"],
    23514: [400, "Value not allowed"],
};

module.exports = (err, req, res, next) => {
    if (res.headersSent) return next(err);
    let status = err.status ?? err.statusCode;
    let message = err.message;
    let details = err.details;

    if (PG_ERRORS[err.code]) [status, message] = PG_ERRORS[err.code];
    else if (err.name === "MulterError")
        status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    else if (err.type === "entity.parse.failed")
        [status, message] = [400, "Malformed JSON"];

    if (!status || status >= 500) {
        (req.log ?? console).error(err);
        [status, message, details] = [500, "Internal server error", undefined];
    }
    res.status(status).json({
        error: { message, ...(details && { details }) },
    });
};
