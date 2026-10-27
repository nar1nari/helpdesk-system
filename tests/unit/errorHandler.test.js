const errorHandler = require("../../src/middlewares/errorHandler");

function mockRes(headersSent = false) {
    const res = { headersSent };
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe("errorHandler", () => {
    let consoleError;

    beforeEach(() => {
        consoleError = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    test("passes the error on when headers were already sent", () => {
        const res = mockRes(true);
        const next = jest.fn();
        const err = new Error("late");

        errorHandler(err, {}, res, next);

        expect(next).toHaveBeenCalledWith(err);
        expect(res.status).not.toHaveBeenCalled();
    });

    test("uses status and message of an app error", () => {
        const res = mockRes();
        const err = Object.assign(new Error("Nope"), { status: 403 });

        errorHandler(err, {}, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: { message: "Nope" } });
    });

    test("uses statusCode when status is missing", () => {
        const res = mockRes();
        const err = Object.assign(new Error("Too big"), { statusCode: 413 });

        errorHandler(err, {}, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(413);
    });

    test("includes details when they exist", () => {
        const res = mockRes();
        const err = Object.assign(new Error("Bad"), {
            status: 400,
            details: [{ path: "a", message: "wrong" }],
        });

        errorHandler(err, {}, res, jest.fn());

        expect(res.json).toHaveBeenCalledWith({
            error: {
                message: "Bad",
                details: [{ path: "a", message: "wrong" }],
            },
        });
    });

    test.each([
        ["22P02", 400],
        ["22003", 400],
        ["22001", 400],
        ["22007", 400],
        ["22008", 400],
        ["23502", 400],
        ["23514", 400],
        ["23001", 409],
        ["23503", 409],
        ["23505", 409],
    ])("maps database error %s to status %i", (code, status) => {
        const res = mockRes();

        errorHandler(
            Object.assign(new Error("db"), { code }),
            {},
            res,
            jest.fn(),
        );

        expect(res.status).toHaveBeenCalledWith(status);
    });

    test("413 for a file that is too large", () => {
        const res = mockRes();
        const err = Object.assign(new Error("big"), {
            name: "MulterError",
            code: "LIMIT_FILE_SIZE",
        });

        errorHandler(err, {}, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(413);
    });

    test("400 for any other upload error", () => {
        const res = mockRes();
        const err = Object.assign(new Error("many"), {
            name: "MulterError",
            code: "LIMIT_FILE_COUNT",
        });

        errorHandler(err, {}, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("400 for malformed JSON", () => {
        const res = mockRes();
        const err = Object.assign(new Error("parse"), {
            type: "entity.parse.failed",
        });

        errorHandler(err, {}, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: { message: "Malformed JSON" },
        });
    });

    test("500 and a safe message for an unknown error", () => {
        const res = mockRes();

        errorHandler(new Error("secret detail"), {}, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: { message: "Internal server error" },
        });
        expect(consoleError).toHaveBeenCalled();
    });

    test("500 hides details of a server error", () => {
        const res = mockRes();
        const err = Object.assign(new Error("boom"), {
            status: 503,
            details: ["private"],
        });

        errorHandler(err, {}, res, jest.fn());

        expect(res.json).toHaveBeenCalledWith({
            error: { message: "Internal server error" },
        });
    });

    test("logs with req.log when it exists", () => {
        const res = mockRes();
        const req = { log: { error: jest.fn() } };
        const err = new Error("boom");

        errorHandler(err, req, res, jest.fn());

        expect(req.log.error).toHaveBeenCalledWith(err);
        expect(consoleError).not.toHaveBeenCalled();
    });
});
