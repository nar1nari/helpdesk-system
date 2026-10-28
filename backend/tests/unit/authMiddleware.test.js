const jwt = require("jsonwebtoken");
const config = require("../../src/config");

jest.mock("../../src/models/users", () => ({
    findById: jest.fn(),
}));

const User = require("../../src/models/users");
const authMiddleware = require("../../src/middlewares/authMiddleware");

const mockRes = () => ({ sendStatus: jest.fn() });
const withToken = (token) => ({
    headers: { authorization: `Bearer ${token}` },
});
const makeToken = (payload = {}, options = {}) =>
    jwt.sign({ sub: 1, ...payload }, config.jwtSecret, options);

describe("authMiddleware", () => {
    beforeEach(() => {
        User.findById.mockReset();
    });

    async function runMiddleware(req, res, next) {
        try {
            await authMiddleware(req, res, next);
        } catch (error) {
            next(error);
        }
    }

    test("401 if no Authorization header", async () => {
        const res = mockRes();
        const next = jest.fn();

        await runMiddleware({ headers: {} }, res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ status: 401 }),
        );
        expect(User.findById).not.toHaveBeenCalled();
    });

    test("401 if token is invalid", async () => {
        const res = mockRes();
        const next = jest.fn();

        await runMiddleware(withToken("garbage"), res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ status: 401 }),
        );
        expect(User.findById).not.toHaveBeenCalled();
    });

    test("401 if token signed with another secret", async () => {
        const res = mockRes();
        const next = jest.fn();
        const token = jwt.sign({ sub: 1 }, "wrong-secret");

        await runMiddleware(withToken(token), res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ status: 401 }),
        );
        expect(User.findById).not.toHaveBeenCalled();
    });

    test("401 if token is expired", async () => {
        const res = mockRes();
        const next = jest.fn();
        const token = makeToken({}, { expiresIn: -10 });

        await runMiddleware(withToken(token), res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ status: 401 }),
        );
        expect(User.findById).not.toHaveBeenCalled();
    });

    test("401 if the user no longer exists", async () => {
        User.findById.mockResolvedValue(undefined);
        const res = mockRes();
        const next = jest.fn();
        const token = makeToken();

        await runMiddleware(withToken(token), res, next);

        expect(User.findById).toHaveBeenCalledWith(1);
        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ status: 401 }),
        );
    });

    test("401 if the user is inactive", async () => {
        User.findById.mockResolvedValue({
            id: 1,
            username: "alice",
            role: "operator",
            is_active: false,
        });
        const res = mockRes();
        const next = jest.fn();

        await runMiddleware(withToken(makeToken()), res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ status: 401 }),
        );
    });

    test("valid token: puts the current user without password in req.user", async () => {
        const user = {
            id: 1,
            username: "alice",
            role: "operator",
            is_active: true,
        };
        User.findById.mockResolvedValue(user);

        const res = mockRes();
        const next = jest.fn();
        const req = withToken(makeToken());

        await runMiddleware(req, res, next);

        expect(User.findById).toHaveBeenCalledWith(1);
        expect(req.user).toEqual(user);
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
    });

    test("passes a lookup error to next()", async () => {
        const error = new Error("db down");
        User.findById.mockRejectedValue(error);
        const res = mockRes();
        const next = jest.fn();

        await runMiddleware(withToken(makeToken()), res, next);

        expect(next).toHaveBeenCalledWith(error);
    });
});
