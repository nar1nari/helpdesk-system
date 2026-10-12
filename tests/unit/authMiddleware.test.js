const jwt = require("jsonwebtoken");

jest.mock("../../src/models/users", () => ({ find: jest.fn() }));

const User = require("../../src/models/users");
const authMiddleware = require("../../src/middlewares/authMiddleware");

const mockRes = () => ({ sendStatus: jest.fn() });
const withToken = (token) => ({
    headers: { authorization: `Bearer ${token}` },
});

describe("authMiddleware", () => {
    beforeEach(() => {
        User.find.mockReset();
    });

    test("401 if no Authorization header", async () => {
        const res = mockRes();
        const next = jest.fn();

        await authMiddleware({ headers: {} }, res, next);

        expect(res.sendStatus).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
        expect(User.find).not.toHaveBeenCalled();
    });

    test("401 if token is invalid", async () => {
        const res = mockRes();
        const next = jest.fn();

        await authMiddleware(withToken("garbage"), res, next);

        expect(res.sendStatus).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
        expect(User.find).not.toHaveBeenCalled();
    });

    test("401 if token signed with another secret", async () => {
        const res = mockRes();
        const next = jest.fn();
        const token = jwt.sign({ username: "alice" }, "wrong-secret");

        await authMiddleware(withToken(token), res, next);

        expect(res.sendStatus).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
        expect(User.find).not.toHaveBeenCalled();
    });

    test("401 if token is expired", async () => {
        const res = mockRes();
        const next = jest.fn();
        const token = jwt.sign({ username: "alice" }, process.env.JWT_SECRET, {
            expiresIn: -10,
        });

        await authMiddleware(withToken(token), res, next);

        expect(res.sendStatus).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
        expect(User.find).not.toHaveBeenCalled();
    });

    test("401 if the user no longer exists", async () => {
        User.find.mockResolvedValue(undefined);
        const res = mockRes();
        const next = jest.fn();
        const token = jwt.sign({ username: "alice" }, process.env.JWT_SECRET);

        await authMiddleware(withToken(token), res, next);

        expect(User.find).toHaveBeenCalledWith("alice");
        expect(res.sendStatus).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("valid token: puts the current user (without password) in req.user and calls next()", async () => {
        User.find.mockResolvedValue({
            id: 1,
            username: "alice",
            password: "hash",
            role: "operator",
        });
        const res = mockRes();
        const next = jest.fn();
        const token = jwt.sign({ username: "alice" }, process.env.JWT_SECRET);
        const req = withToken(token);

        await authMiddleware(req, res, next);

        expect(User.find).toHaveBeenCalledWith("alice");
        expect(req.user).toEqual({
            id: 1,
            username: "alice",
            role: "operator",
        });
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
        expect(res.sendStatus).not.toHaveBeenCalled();
    });

    test("passes a lookup error to next()", async () => {
        const error = new Error("db down");
        User.find.mockRejectedValue(error);
        const res = mockRes();
        const next = jest.fn();
        const token = jwt.sign({ username: "alice" }, process.env.JWT_SECRET);

        await authMiddleware(withToken(token), res, next);

        expect(next).toHaveBeenCalledWith(error);
        expect(res.sendStatus).not.toHaveBeenCalled();
    });
});
