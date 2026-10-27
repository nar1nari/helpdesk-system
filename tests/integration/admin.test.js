const request = require("supertest");
const createApp = require("../helpers/createApp");
const createAuthHelpers = require("../helpers/authHelpers");

describe("Admin API", () => {
    let app;
    let signUp;
    let auth;
    let admin;

    beforeEach(async () => {
        app = createApp();
        ({ signUp, auth } = createAuthHelpers(app));
        admin = await signUp("admin1", "admin");
    });

    const newUser = { username: "bob", password: "secret123" };

    describe("POST /admin/users", () => {
        test("401 without token", async () => {
            const res = await request(app).post("/admin/users").send(newUser);
            expect(res.status).toBe(401);
        });

        test("403 for a non-admin", async () => {
            const alice = await signUp("alice");
            const res = await request(app)
                .post("/admin/users")
                .set(auth(alice.token))
                .send(newUser);
            expect(res.status).toBe(403);
        });

        test("admin creates a user with the default role", async () => {
            const res = await request(app)
                .post("/admin/users")
                .set(auth(admin.token))
                .send(newUser);
            expect(res.status).toBe(201);
            expect(res.body.user).toMatchObject({
                username: "bob",
                role: "applicant",
                is_active: true,
            });
        });

        test("admin creates a user with a chosen role", async () => {
            const res = await request(app)
                .post("/admin/users")
                .set(auth(admin.token))
                .send({ ...newUser, role: "operator" });
            expect(res.status).toBe(201);
            expect(res.body.user.role).toBe("operator");
        });

        test("400 for an unknown role", async () => {
            const res = await request(app)
                .post("/admin/users")
                .set(auth(admin.token))
                .send({ ...newUser, role: "boss" });
            expect(res.status).toBe(400);
        });

        test("400 for a short password", async () => {
            const res = await request(app)
                .post("/admin/users")
                .set(auth(admin.token))
                .send({ ...newUser, password: "123" });
            expect(res.status).toBe(400);
        });
    });

    describe("GET /admin/users", () => {
        test("403 for a non-admin", async () => {
            const alice = await signUp("alice");
            const res = await request(app)
                .get("/admin/users")
                .set(auth(alice.token));
            expect(res.status).toBe(403);
        });

        test("returns all users, not just the first one", async () => {
            await signUp("alice");
            await signUp("bob");
            const res = await request(app)
                .get("/admin/users")
                .set(auth(admin.token));
            expect(res.status).toBe(200);
            expect(res.body.users.map((u) => u.username)).toEqual([
                "admin1",
                "alice",
                "bob",
            ]);
        });

        test("does not expose password hashes", async () => {
            const res = await request(app)
                .get("/admin/users")
                .set(auth(admin.token));
            expect(res.body.users[0]).not.toHaveProperty("password");
        });
    });

    describe("PATCH /admin/users/:id", () => {
        const patch = (id, body, token = admin.token) =>
            request(app)
                .patch(`/admin/users/${id}`)
                .set(auth(token))
                .send(body);

        test("403 for a non-admin", async () => {
            const alice = await signUp("alice");
            const res = await patch(
                alice.user.id,
                { role: "admin" },
                alice.token,
            );
            expect(res.status).toBe(403);
        });

        test("404 for an unknown user", async () => {
            const res = await patch(99999, { role: "operator" });
            expect(res.status).toBe(404);
        });

        test("400 for an invalid id", async () => {
            const res = await patch("abc", { role: "operator" });
            expect(res.status).toBe(400);
        });

        test("changes the role", async () => {
            const alice = await signUp("alice");
            const res = await patch(alice.user.id, { role: "operator" });
            expect(res.status).toBe(200);
            expect(res.body.user.role).toBe("operator");
        });

        test("deactivates a user", async () => {
            const alice = await signUp("alice");
            const res = await patch(alice.user.id, { isActive: false });
            expect(res.status).toBe(200);
            expect(res.body.user.is_active).toBe(false);
        });

        test("a deactivated user cannot use the API any more", async () => {
            const alice = await signUp("alice");
            await patch(alice.user.id, { isActive: false });
            const res = await request(app)
                .get("/auth/me")
                .set(auth(alice.token));
            expect(res.status).toBe(401);
        });

        test("reactivates a user", async () => {
            const alice = await signUp("alice");
            await patch(alice.user.id, { isActive: false });
            const res = await patch(alice.user.id, { isActive: true });
            expect(res.body.user.is_active).toBe(true);
        });

        test("changes role and active flag together", async () => {
            const alice = await signUp("alice");
            const res = await patch(alice.user.id, {
                role: "operator",
                isActive: false,
            });
            expect(res.body.user).toMatchObject({
                role: "operator",
                is_active: false,
            });
        });

        test("deactivating a user keeps their role", async () => {
            const operator = await signUp("operator", "operator");
            const res = await patch(operator.user.id, { isActive: false });
            expect(res.body.user.role).toBe("operator");
        });

        test("empty body changes nothing and returns the user", async () => {
            const alice = await signUp("alice");
            const res = await patch(alice.user.id, {});
            expect(res.status).toBe(200);
            expect(res.body.user).toMatchObject({
                username: "alice",
                role: "applicant",
                is_active: true,
            });
        });
    });
});
