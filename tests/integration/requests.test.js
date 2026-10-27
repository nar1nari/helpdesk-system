const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../../src/db");
const Category = require("../../src/models/category");
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
            await Request.assignOperator(created.id, other.user.id);

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
            await Request.assignOperator(mine.id, operator.user.id);
            await Request.assignOperator(foreign.id, other.user.id);

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
            await Request.setStatus(second.id, Request.Status.IN_PROGRESS);

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
            await Request.assignOperator(created.id, other.user.id);

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
            await Request.assignOperator(created.id, operator.user.id);

            const res = await request(app)
                .patch(`/requests/${created.id}/status`)
                .set(auth(operator.token))
                .send({ status: Request.Status.IN_PROGRESS });

            expect(res.status).toBe(200);
            expect(res.body.request.status).toBe(Request.Status.IN_PROGRESS);
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
            expect(res.body.error.message).toBe("Validation failed");
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
            expect(res.body.request.assigned_operator_id).toEqual(
                operator.user.id,
            );
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

        test("404 when operator takes an already assigned request", async () => {
            const alice = await signUp("alice");
            const operator = await signUp("operator", "operator");
            const other = await signUp("operator2", "operator");
            const created = await createRequest(alice.token);
            await Request.assignOperator(created.id, other.user.id);

            const res = await request(app)
                .patch(`/requests/${created.id}/assign`)
                .set(auth(operator.token))
                .send({ operator_id: operator.user.id });

            expect(res.status).toBe(404);
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
            await Request.assignOperator(created.id, other.user.id);

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

    describe("POST /requests (extra checks)", () => {
        test("400 when the category does not exist", async () => {
            const alice = await signUp("alice");
            const res = await request(app)
                .post("/requests")
                .set(auth(alice.token))
                .send({
                    category_id: 99999,
                    title: "Title",
                    description: "Text",
                });
            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe("Unknown category_id");
        });

        test("accepts a description of 5000 characters", async () => {
            const alice = await signUp("alice");
            const res = await request(app)
                .post("/requests")
                .set(auth(alice.token))
                .send({
                    category_id: category.id,
                    title: "Title",
                    description: "a".repeat(5000),
                });
            expect(res.status).toBe(201);
        });

        test("400 (not 500) when the description is longer than 5000", async () => {
            const alice = await signUp("alice");
            const res = await request(app)
                .post("/requests")
                .set(auth(alice.token))
                .send({
                    category_id: category.id,
                    title: "Title",
                    description: "a".repeat(5001),
                });
            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe("Validation failed");
        });
    });

    describe("GET /requests (more filters)", () => {
        test("filters by category_id", async () => {
            const alice = await signUp("alice");
            const other = await Category.add("category2");
            await createRequest(alice.token);
            await createRequest(alice.token, { category_id: other.id });

            const res = await request(app)
                .get(`/requests?category_id=${other.id}`)
                .set(auth(alice.token));

            expect(res.body.requests).toHaveLength(1);
            expect(res.body.requests[0].category_name).toBe("category2");
        });

        test("filters by assigned_operator_id", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const operator = await signUp("operator", "operator");
            const first = await createRequest(alice.token);
            await createRequest(alice.token);
            await Request.assignOperator(first.id, operator.user.id);

            const res = await request(app)
                .get(`/requests?assigned_operator_id=${operator.user.id}`)
                .set(auth(admin.token));

            expect(res.body.requests.map((r) => r.id)).toEqual([first.id]);
        });

        test("filters by search text in the description", async () => {
            const alice = await signUp("alice");
            await createRequest(alice.token, { description: "printer broken" });
            await createRequest(alice.token, { description: "no network" });

            const res = await request(app)
                .get("/requests?search=printer")
                .set(auth(alice.token));

            expect(res.body.requests).toHaveLength(1);
        });

        test("search treats % as a normal character", async () => {
            const alice = await signUp("alice");
            await createRequest(alice.token, { title: "100% broken" });
            await createRequest(alice.token, { title: "other" });

            const res = await request(app)
                .get("/requests?search=%25")
                .set(auth(alice.token));

            expect(res.body.requests).toHaveLength(1);
            expect(res.body.requests[0].title).toBe("100% broken");
        });

        test("filters by date_from and date_to", async () => {
            const alice = await signUp("alice");
            const old = await createRequest(alice.token);
            const recent = await createRequest(alice.token);
            await db.query(
                "UPDATE requests SET created_at = '2020-01-15 12:00+00' WHERE id = $1",
                [old.id],
            );

            const onlyOld = await request(app)
                .get("/requests?date_from=2020-01-01&date_to=2020-01-31")
                .set(auth(alice.token));
            expect(onlyOld.body.requests.map((r) => r.id)).toEqual([old.id]);

            const onlyRecent = await request(app)
                .get("/requests?date_from=2021-01-01")
                .set(auth(alice.token));
            expect(onlyRecent.body.requests.map((r) => r.id)).toEqual([
                recent.id,
            ]);
        });

        test("400 for a date in the wrong format", async () => {
            const alice = await signUp("alice");
            const res = await request(app)
                .get("/requests?date_from=01-02-2020")
                .set(auth(alice.token));
            expect(res.status).toBe(400);
        });

        test("400 (not 500) for a date that does not exist", async () => {
            const alice = await signUp("alice");
            const res = await request(app)
                .get("/requests?date_from=2024-02-31")
                .set(auth(alice.token));
            expect(res.status).toBe(400);
        });

        test("400 for an unknown status filter", async () => {
            const alice = await signUp("alice");
            const res = await request(app)
                .get("/requests?status=weird")
                .set(auth(alice.token));
            expect(res.status).toBe(400);
        });
    });

    describe("PATCH /requests/:id/status (transitions)", () => {
        const setStatus = (token, id, status) =>
            request(app)
                .patch(`/requests/${id}/status`)
                .set(auth(token))
                .send({ status });

        test("409 for a transition that is not allowed", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequest(alice.token);

            const res = await setStatus(admin.token, created.id, "closed");

            expect(res.status).toBe(409);
            expect(res.body.error.message).toBe(
                "Cannot change status from new to closed",
            );
        });

        test("saves a status history record", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequest(alice.token);

            await setStatus(admin.token, created.id, "in_progress");

            const res = await request(app)
                .get(`/requests/${created.id}/status`)
                .set(auth(admin.token));
            expect(res.status).toBe(200);
            expect(res.body.status_history).toHaveLength(1);
            expect(res.body.status_history[0]).toMatchObject({
                request_id: created.id,
                changed_by: admin.user.id,
                old_status: "new",
                new_status: "in_progress",
            });
        });

        test("applicant can close a resolved request", async () => {
            const alice = await signUp("alice");
            const created = await createRequest(alice.token);
            await db.query("UPDATE requests SET status = 'resolved'");

            const res = await setStatus(alice.token, created.id, "closed");

            expect(res.status).toBe(200);
            expect(res.body.request.status).toBe("closed");
        });

        test("403 when the role is not allowed to make this transition", async () => {
            const alice = await signUp("alice");
            const operator = await signUp("operator", "operator");
            const created = await createRequest(alice.token);
            await Request.assignOperator(created.id, operator.user.id);
            await db.query("UPDATE requests SET status = 'resolved'");

            // only the applicant or an admin may close a resolved request
            const res = await setStatus(operator.token, created.id, "closed");

            expect(res.status).toBe(403);
        });
    });

    describe("GET /requests/:id/status", () => {
        test("401 without token", async () => {
            const res = await request(app).get("/requests/1/status");
            expect(res.status).toBe(401);
        });

        test("404 for an unknown request", async () => {
            const alice = await signUp("alice");
            const res = await request(app)
                .get("/requests/99999/status")
                .set(auth(alice.token));
            expect(res.status).toBe(404);
        });

        test("returns an empty history for a new request", async () => {
            const alice = await signUp("alice");
            const created = await createRequest(alice.token);
            const res = await request(app)
                .get(`/requests/${created.id}/status`)
                .set(auth(alice.token));
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status_history: [] });
        });

        test("404 when applicant opens someone else's history", async () => {
            const alice = await signUp("alice");
            const bob = await signUp("bob");
            const created = await createRequest(alice.token);
            const res = await request(app)
                .get(`/requests/${created.id}/status`)
                .set(auth(bob.token));
            expect(res.status).toBe(404);
        });
    });

    describe("PATCH /requests/:id/assign (operator checks)", () => {
        const assign = (token, id, operator_id) =>
            request(app)
                .patch(`/requests/${id}/assign`)
                .set(auth(token))
                .send({ operator_id });

        test("400 when operator_id does not exist", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequest(alice.token);
            const res = await assign(admin.token, created.id, 99999);
            expect(res.status).toBe(400);
        });

        test("400 when operator_id belongs to an applicant", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequest(alice.token);
            const res = await assign(admin.token, created.id, alice.user.id);
            expect(res.status).toBe(400);
        });

        test("400 when the operator is deactivated", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const operator = await signUp("operator", "operator");
            await db.query("UPDATE users SET is_active = false WHERE id = $1", [
                operator.user.id,
            ]);
            const created = await createRequest(alice.token);
            const res = await assign(admin.token, created.id, operator.user.id);
            expect(res.status).toBe(400);
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
