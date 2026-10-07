const jwt = require("jsonwebtoken");
const authMiddleware = require("../../src/middlewares/authMiddleware");

function mockRes() {
    return { sendStatus: jest.fn() };
}

describe("authMiddleware", () => {
    test("401 if no Authorization header", () => {
        const res = mockRes();
        const next = jest.fn();
        authMiddleware({ headers: {} }, res, next);
        expect(res.sendStatus).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("401 if token is invalid", (done) => {
        const res = { sendStatus: jest.fn(() => done()) };
        const next = jest.fn();
        authMiddleware(
            { headers: { authorization: "Bearer garbage" } },
            res,
            next,
        );
        expect(next).not.toHaveBeenCalled();
    });

    test("401 if token signed with another secret", (done) => {
        const token = jwt.sign({ username: "a" }, "wrong-secret");
        const res = { sendStatus: jest.fn(() => done()) };
        authMiddleware(
            { headers: { authorization: `Bearer ${token}` } },
            res,
            jest.fn(),
        );
        expect(res.sendStatus).not.toHaveBeenCalledWith(200);
    });

    test("401 if token is expired", (done) => {
        const token = jwt.sign({ username: "a" }, process.env.JWT_SECRET, {
            expiresIn: -10,
        });
        const res = {
            sendStatus: jest.fn((code) => {
                expect(code).toBe(401);
                done();
            }),
        };
        authMiddleware(
            { headers: { authorization: `Bearer ${token}` } },
            res,
            jest.fn(),
        );
    });

    test("valid token: puts payload in req.user and calls next()", (done) => {
        const token = jwt.sign({ username: "alice" }, process.env.JWT_SECRET);
        const req = { headers: { authorization: `Bearer ${token}` } };
        authMiddleware(req, mockRes(), () => {
            expect(req.user.username).toBe("alice");
            done();
        });
    });
});
