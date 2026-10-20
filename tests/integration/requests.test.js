const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../../src/db");
const Category = require("../../src/models/categories");
const Request = require("../../src/models/requests");
const createAuthHelpers = require("../helpers/authHelpers");

describe("Requests API", () => {
    let app;
    let category;
    let signUp;
    let auth;

    beforeEach(async () => {
        app = createApp();
        ({ signUp, auth } = createAuthHelpers(app));
        category = await Category.add("category1");
    });

    async function createRequest(token, overrides = {}) {
        const res = await request(app)
            .post("/requests")
            .set(auth(token))
            .send({
                category_id: category.id,
                title: "Test request",
                description: "Test description",
                ...overrides,
            });
        return res.body.request;
    }

    describe("POST /requests", () => {
        test("401 without token", async () => {
            const res = await request(app).post("/requests").send({
                category_id: category.id,
                title: "Test request",
                description: "Test description",
            });
            expect(res.status).toBe(401);
        });

        test("creates request for the current user", async () => {
            const { token, user } = await signUp("alice");

            const res = await request(app)
                .post("/requests")
                .set(auth(token))
                .send({
                    category_id: category.id,
                    title: "Printer is broken",
                    description: "It does not print",
                });

            expect(res.status).toBe(201);
            expect(res.body.request).toMatchObject({
                user_id: user.id,
                category_id: category.id,
                title: "Printer is broken",
                description: "It does not print",
                status: Request.Status.NEW,
                assigned_operator_id: null,
            });
            expect(res.body.request.id).toBeDefined();
        });

        test("400 when required fields are missing", async () => {
            const { token } = await signUp("alice");

            const res = await request(app)
                .post("/requests")
                .set(auth(token))
                .send({ category_id: category.id, title: "No description" });

            expect(res.status).toBe(400);
        });
    });

    describe("GET /requests/:id", () => {
        test("401 without token", async () => {
            const res = await request(app).get("/requests/1");
            expect(res.status).toBe(401);
        });

        test("returns own request to applicant", async () => {
            const { token } = await signUp("alice");
            const created = await createRequest(token);

            const res = await request(app)
                .get(`/requests/${created.id}`)
                .set(auth(token));

            expect(res.status).toBe(200);
            expect(res.body.request).toMatchObject({
                id: created.id,
                title: "Test request",
            });
        });

        test("404 for unknown request", async () => {
            const { token } = await signUp("alice");

            const res = await request(app).get("/requests/42").set(auth(token));

            expect(res.status).toBe(404);
        });

        test("404 when applicant opens someone else's request", async () => {
            const alice = await signUp("alice");
            const bob = await signUp("bob");
            const created = await createRequest(alice.token);

            const res = await request(app)
                .get(`/requests/${created.id}`)
                .set(auth(bob.token));

            expect(res.status).toBe(404);
        });

        test("404 when operator opens request assigned to another operator", async () => {
            const alice = await signUp("alice");
            const operator = await signUp("operator", "operator");
            const other = await signUp("operator2", "operator");
            const created = await createRequest(alice.token);
            await Request.assign_operator(created.id, other.user.id);

            const res = await request(app)
                .get(`/requests/${created.id}`)
                .set(auth(operator.token));

            expect(res.status).toBe(404);
        });

        test("operator can open an unassigned request", async () => {
            const alice = await signUp("alice");
            const operator = await signUp("operator", "operator");
            const created = await createRequest(alice.token);

            const res = await request(app)
                .get(`/requests/${created.id}`)
                .set(auth(operator.token));

            expect(res.status).toBe(200);
            expect(res.body.request.id).toBe(created.id);
        });

        test("admin can open any request", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequest(alice.token);

            const res = await request(app)
                .get(`/requests/${created.id}`)
                .set(auth(admin.token));

            expect(res.status).toBe(200);
            expect(res.body.request.id).toBe(created.id);
        });
    });

    describe("GET /requests", () => {
        test("401 without token", async () => {
            const res = await request(app).get("/requests");
            expect(res.status).toBe(401);
        });

        test("applicant sees only own requests", async () => {
            const alice = await signUp("alice");
            const bob = await signUp("bob");
            const own = await createRequest(alice.token, { title: "Own" });
            await createRequest(bob.token, { title: "Foreign" });

            const res = await request(app)
                .get("/requests")
                .set(auth(alice.token));

            expect(res.status).toBe(200);
            expect(res.body.requests).toMatchObject([{ id: own.id }]);
            expect(res.body.requests).toHaveLength(1);
        });

        test("operator sees unassigned and own assigned requests", async () => {
            const alice = await signUp("alice");
            const operator = await signUp("operator", "operator");
            const other = await signUp("operator2", "operator");

            const unassigned = await createRequest(alice.token, {
                title: "Unassigned",
            });
            const mine = await createRequest(alice.token, { title: "Mine" });
            const foreign = await createRequest(alice.token, {
                title: "Foreign",
            });
            await Request.assign_operator(mine.id, operator.user.id);
            await Request.assign_operator(foreign.id, other.user.id);

            const res = await request(app)
                .get("/requests")
                .set(auth(operator.token));

            expect(res.status).toBe(200);
            const ids = res.body.requests.map((r) => r.id);
            expect(ids).toHaveLength(2);
            expect(ids).toEqual(
                expect.arrayContaining([unassigned.id, mine.id]),
            );
            expect(ids).not.toContain(foreign.id);
        });

        test("admin sees all requests", async () => {
            const alice = await signUp("alice");
            const bob = await signUp("bob");
            const admin = await signUp("admin", "admin");
            await createRequest(alice.token);
            await createRequest(bob.token);

            const res = await request(app)
                .get("/requests")
                .set(auth(admin.token));

            expect(res.status).toBe(200);
            expect(res.body.requests).toHaveLength(2);
            expect(res.body.pagination).toMatchObject({
                page: 1,
                limit: 20,
                total: 2,
                totalPages: 1,
            });
        });

        test("filters by status via query", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            await createRequest(alice.token);
            const second = await createRequest(alice.token, {
                title: "Second",
            });
            await Request.set_status(second.id, Request.Status.IN_PROGRESS);

            const res = await request(app)
                .get("/requests")
                .query({ status: Request.Status.IN_PROGRESS })
                .set(auth(admin.token));

            expect(res.status).toBe(200);
            expect(res.body.requests).toMatchObject([{ id: second.id }]);
            expect(res.body.requests).toHaveLength(1);
        });

        test("searches by title via query", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const printer = await createRequest(alice.token, {
                title: "Printer is broken",
            });
            await createRequest(alice.token, { title: "Network problem" });

            const res = await request(app)
                .get("/requests")
                .query({ search: "printer" })
                .set(auth(admin.token));

            expect(res.status).toBe(200);
            expect(res.body.requests).toMatchObject([{ id: printer.id }]);
            expect(res.body.requests).toHaveLength(1);
        });

        test("sorts and paginates via query", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            await createRequest(alice.token, { title: "First" });
            await createRequest(alice.token, { title: "Second" });
            await createRequest(alice.token, { title: "Third" });

            const res = await request(app)
                .get("/requests")
                .query({
                    page: 2,
                    limit: 2,
                    sort_by: "title",
                    sort_order: "asc",
                })
                .set(auth(admin.token));

            expect(res.status).toBe(200);
            expect(res.body.requests).toHaveLength(1);
            expect(res.body.requests[0].title).toBe("Third");
            expect(res.body.pagination).toMatchObject({
                page: 2,
                limit: 2,
                total: 3,
            });
        });

        test.each([
            ["status", { status: "invalid" }],
            ["page", { page: 0 }],
            ["limit", { limit: 101 }],
            ["sort_by", { sort_by: "invalid" }],
            ["sort_order", { sort_order: "invalid" }],
        ])("400 with invalid %s", async (_name, query) => {
            const admin = await signUp("admin", "admin");

            const res = await request(app)
                .get("/requests")
                .query(query)
                .set(auth(admin.token));

            expect(res.status).toBe(400);
        });
    });

    describe("PATCH /requests/:id/status", () => {
        test("401 without token", async () => {
            const res = await request(app)
                .patch("/requests/1/status")
                .send({ status: Request.Status.IN_PROGRESS });
            expect(res.status).toBe(401);
        });

        test("404 for unknown request", async () => {
            const admin = await signUp("admin", "admin");

            const res = await request(app)
                .patch("/requests/42/status")
                .set(auth(admin.token))
                .send({ status: Request.Status.IN_PROGRESS });

            expect(res.status).toBe(404);
        });

        test("404 for applicant", async () => {
            const alice = await signUp("alice");
            const created = await createRequest(alice.token);

            const res = await request(app)
                .patch(`/requests/${created.id}/status`)
                .set(auth(alice.token))
                .send({ status: Request.Status.IN_PROGRESS });

            expect(res.status).toBe(404);
            expect(res.body.error.message).toBe("Request not found");
            expect((await Request.get(created.id)).status).toBe(
                Request.Status.NEW,
            );
        });

        test("404 for operator when request is not assigned to them", async () => {
            const alice = await signUp("alice");
            const operator = await signUp("operator", "operator");
            const other = await signUp("operator2", "operator");
            const created = await createRequest(alice.token);
            await Request.assign_operator(created.id, other.user.id);

            const res = await request(app)
                .patch(`/requests/${created.id}/status`)
                .set(auth(operator.token))
                .send({ status: Request.Status.IN_PROGRESS });

            expect(res.status).toBe(404);
            expect((await Request.get(created.id)).status).toBe(
                Request.Status.NEW,
            );
        });

        test("404 for operator when request is unassigned", async () => {
            const alice = await signUp("alice");
            const operator = await signUp("operator", "operator");
            const created = await createRequest(alice.token);

            const res = await request(app)
                .patch(`/requests/${created.id}/status`)
                .set(auth(operator.token))
                .send({ status: Request.Status.IN_PROGRESS });

            expect(res.status).toBe(404);
        });

        test("updates status for assigned operator", async () => {
            const alice = await signUp("alice");
            const operator = await signUp("operator", "operator");
            const created = await createRequest(alice.token);
            await Request.assign_operator(created.id, operator.user.id);

            const res = await request(app)
                .patch(`/requests/${created.id}/status`)
                .set(auth(operator.token))
                .send({ status: Request.Status.IN_PROGRESS });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe(Request.Status.IN_PROGRESS);
            expect((await Request.get(created.id)).status).toBe(
                Request.Status.IN_PROGRESS,
            );
        });

        test("updates status for admin on any request", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequest(alice.token);

            const res = await request(app)
                .patch(`/requests/${created.id}/status`)
                .set(auth(admin.token))
                .send({ status: Request.Status.REJECTED });

            expect(res.status).toBe(200);
            expect((await Request.get(created.id)).status).toBe(
                Request.Status.REJECTED,
            );
        });

        test("400 for invalid status", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequest(alice.token);

            const res = await request(app)
                .patch(`/requests/${created.id}/status`)
                .set(auth(admin.token))
                .send({ status: "invalid" });

            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe("Invalid status");
        });
    });

    describe("PATCH /requests/:id/assign", () => {
        test("401 without token", async () => {
            const res = await request(app)
                .patch("/requests/1/assign")
                .send({ operator_id: 1 });
            expect(res.status).toBe(401);
        });

        test("404 for unknown request", async () => {
            const admin = await signUp("admin", "admin");

            const res = await request(app)
                .patch("/requests/42/assign")
                .set(auth(admin.token))
                .send({ operator_id: admin.user.id });

            expect(res.status).toBe(404);
        });

        test("400 without operator_id", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequest(alice.token);

            const res = await request(app)
                .patch(`/requests/${created.id}/assign`)
                .set(auth(admin.token))
                .send({});

            expect(res.status).toBe(400);
        });

        test("403 for applicant", async () => {
            const alice = await signUp("alice");
            const operator = await signUp("operator", "operator");
            const created = await createRequest(alice.token);

            const res = await request(app)
                .patch(`/requests/${created.id}/assign`)
                .set(auth(alice.token))
                .send({ operator_id: operator.user.id });

            expect(res.status).toBe(403);
            expect((await Request.get(created.id)).assigned_operator_id).toBe(
                null,
            );
        });

        test("operator can take an unassigned request", async () => {
            const alice = await signUp("alice");
            const operator = await signUp("operator", "operator");
            const created = await createRequest(alice.token);

            const res = await request(app)
                .patch(`/requests/${created.id}/assign`)
                .set(auth(operator.token))
                .send({ operator_id: operator.user.id });

            expect(res.status).toBe(200);
            expect(res.body.assigned_operator_id).toEqual({
                assigned_operator_id: operator.user.id,
            });
            expect((await Request.get(created.id)).assigned_operator_id).toBe(
                operator.user.id,
            );
        });

        test("403 when operator assigns another operator", async () => {
            const alice = await signUp("alice");
            const operator = await signUp("operator", "operator");
            const other = await signUp("operator2", "operator");
            const created = await createRequest(alice.token);

            const res = await request(app)
                .patch(`/requests/${created.id}/assign`)
                .set(auth(operator.token))
                .send({ operator_id: other.user.id });

            expect(res.status).toBe(403);
            expect((await Request.get(created.id)).assigned_operator_id).toBe(
                null,
            );
        });

        test("403 when operator takes an already assigned request", async () => {
            const alice = await signUp("alice");
            const operator = await signUp("operator", "operator");
            const other = await signUp("operator2", "operator");
            const created = await createRequest(alice.token);
            await Request.assign_operator(created.id, other.user.id);

            const res = await request(app)
                .patch(`/requests/${created.id}/assign`)
                .set(auth(operator.token))
                .send({ operator_id: operator.user.id });

            expect(res.status).toBe(403);
            expect((await Request.get(created.id)).assigned_operator_id).toBe(
                other.user.id,
            );
        });

        test("admin can assign an operator", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const operator = await signUp("operator", "operator");
            const created = await createRequest(alice.token);

            const res = await request(app)
                .patch(`/requests/${created.id}/assign`)
                .set(auth(admin.token))
                .send({ operator_id: operator.user.id });

            expect(res.status).toBe(200);
            expect((await Request.get(created.id)).assigned_operator_id).toBe(
                operator.user.id,
            );
        });

        test("admin can reassign an already assigned request", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const operator = await signUp("operator", "operator");
            const other = await signUp("operator2", "operator");
            const created = await createRequest(alice.token);
            await Request.assign_operator(created.id, other.user.id);

            const res = await request(app)
                .patch(`/requests/${created.id}/assign`)
                .set(auth(admin.token))
                .send({ operator_id: operator.user.id });

            expect(res.status).toBe(200);
            expect((await Request.get(created.id)).assigned_operator_id).toBe(
                operator.user.id,
            );
        });
    });

    describe("valid token of a deleted user", () => {
        test.each([
            ["post", "/requests"],
            ["get", "/requests"],
            ["get", "/requests/1"],
            ["patch", "/requests/1/status"],
            ["patch", "/requests/1/assign"],
        ])("401 for %s %s", async (method, path) => {
            const { token } = await signUp("ghost");
            await db.query("DELETE FROM users WHERE username = $1", ["ghost"]);

            const res = await request(app)
                [method](path)
                .set(auth(token))
                .send({});

            expect(res.status).toBe(401);
        });
    });
});
