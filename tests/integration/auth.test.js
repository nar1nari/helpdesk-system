const request = require("supertest");
const jwt = require("jsonwebtoken");
const createApp = require("../helpers/createApp");

const creds = { username: "alice", password: "secret123" };

describe("Auth API", () => {
    let app;

    beforeEach(() => {
        app = createApp();
    });

    describe("POST /auth/register", () => {
        test("registers new user", async () => {
            const res = await request(app).post("/auth/register").send(creds);
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: "User registered" });
        });

        test("400 when registers existing username", async () => {
            await request(app).post("/auth/register").send(creds);
            const res = await request(app).post("/auth/register").send(creds);
            expect(res.status).toBe(400);
            expect(res.body.message).toBe("User already exists");
        });

        test("password is hashed", async () => {
            await request(app).post("/auth/register").send(creds);
            const User = require("../../src/models/users");
            const stored = User.find(creds.username);
            expect(stored.password).not.toBe(creds.password);
            expect(stored.password).toMatch(/^\$2[aby]\$/);
        });

        test("new user gets applicant role by default", async () => {
            await request(app).post("/auth/register").send(creds);
            const User = require("../../src/models/users");
            expect(User.find(creds.username).role).toBe("applicant");
        });
    });

    describe("POST /auth/login", () => {
        beforeEach(async () => {
            await request(app).post("/auth/register").send(creds);
        });

        test("gives JWT when data is correct", async () => {
            const res = await request(app).post("/auth/login").send(creds);
            expect(res.status).toBe(200);
            const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
            expect(payload.username).toBe(creds.username);
            expect(payload.exp).toBeGreaterThan(payload.iat);
        });

        test("401 when password is wrong", async () => {
            const res = await request(app)
                .post("/auth/login")
                .send({ ...creds, password: "wrong" });
            expect(res.status).toBe(401);
            expect(res.body.message).toBe("Invalid credentials");
        });

        test("401 when user does not exist", async () => {
            const res = await request(app)
                .post("/auth/login")
                .send({ username: "ghost", password: "x" });
            expect(res.status).toBe(401);
            expect(res.body.message).toBe("Invalid credentials");
        });
    });

    describe("GET /auth/me", () => {
        test("401 without token", async () => {
            const res = await request(app).get("/auth/me");
            expect(res.status).toBe(401);
        });

        test("401 with invalid token", async () => {
            const res = await request(app)
                .get("/auth/me")
                .set("Authorization", "Bearer nope");
            expect(res.status).toBe(401);
        });

        test("returns user info with valid token", async () => {
            await request(app).post("/auth/register").send(creds);
            const login = await request(app).post("/auth/login").send(creds);
            const res = await request(app)
                .get("/auth/me")
                .set("Authorization", `Bearer ${login.body.token}`);
            expect(res.status).toBe(200);
            expect(res.body.username).toBe(creds.username);
        });
    });
});
