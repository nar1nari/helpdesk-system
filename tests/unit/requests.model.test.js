const Request = require("../../src/models/requests");
const User = require("../../src/models/users");
const Category = require("../../src/models/category");

describe("Request model", () => {
    let user;
    let admin;
    let operator;
    let category;

    beforeEach(async () => {
        user = await User.create("alice", "secret123");
        admin = await User.create("admin", "secret123", "admin");
        operator = await User.create("operator", "secret456", "operator");
        category = await Category.add("category1");
    });

    async function createRequest(overrides = {}) {
        return Request.create(
            overrides.user_id ?? user.id,
            overrides.category_id ?? category.id,
            overrides.title ?? "Test request",
            overrides.description ?? "Test description",
        );
    }

    // list() requires a role; admin sees everything without extra filters
    const listAsAdmin = (options = {}) =>
        Request.list({ user: admin, ...options });

    test("create() creates a request with default status", async () => {
        const request = await createRequest();

        expect(request).toMatchObject({
            user_id: user.id,
            category_id: category.id,
            title: "Test request",
            description: "Test description",
            status: Request.Status.NEW,
            assigned_operator_id: null,
        });
        expect(request.id).toBeDefined();
        expect(request.created_at).toBeDefined();
        expect(request.updated_at).toBeDefined();
    });

    test("get() finds request by id", async () => {
        const request = await createRequest();

        expect(await Request.get(request.id)).toMatchObject(request);
    });

    test("get() returns undefined for unknown request", async () => {
        expect(await Request.get(-1)).toBeUndefined();
    });

    test("setStatus() updates request status", async () => {
        const request = await createRequest();

        const result = await Request.setStatus(
            request.id,
            Request.Status.IN_PROGRESS,
        );

        expect(result.status).toBe(Request.Status.IN_PROGRESS);
        expect((await Request.get(request.id)).status).toBe(
            Request.Status.IN_PROGRESS,
        );
    });

    test("setStatus() rejects invalid status", async () => {
        const request = await createRequest();

        await expect(Request.setStatus(request.id, "invalid")).rejects.toThrow(
            "Invalid status",
        );
    });

    test("assignOperator() assigns an operator to a request", async () => {
        const request = await createRequest();

        const result = await Request.assignOperator(request.id, operator.id);

        expect(result.assigned_operator_id).toBe(operator.id);
        expect((await Request.get(request.id)).assigned_operator_id).toBe(
            operator.id,
        );
    });

    test("list() returns all requests for admin", async () => {
        const request1 = await createRequest({ title: "First request" });
        const request2 = await createRequest({ title: "Second request" });

        const result = await listAsAdmin();

        expect(result.requests).toHaveLength(2);
        expect(result.requests).toMatchObject([request2, request1]);
        expect(result.pagination).toMatchObject({
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 1,
        });
    });

    test("list() shows applicant only their own requests", async () => {
        const other = await User.create("bob", "secret789");
        const own = await createRequest({ title: "Own request" });
        await createRequest({ user_id: other.id, title: "Foreign request" });

        const result = await Request.list({
            user: user,
        });

        expect(result.requests).toMatchObject([{ id: own.id }]);
        expect(result.requests).toHaveLength(1);
    });

    test("list() shows operator unassigned and own assigned requests", async () => {
        const otherOperator = await User.create("operator2", "secret000");
        const unassigned = await createRequest({ title: "Unassigned" });
        const mine = await createRequest({ title: "Mine" });
        const foreign = await createRequest({ title: "Foreign" });

        await Request.assignOperator(mine.id, operator.id);
        await Request.assignOperator(foreign.id, otherOperator.id);

        const result = await Request.list({
            user: operator,
        });

        const ids = result.requests.map((r) => r.id);
        expect(ids).toHaveLength(2);
        expect(ids).toEqual(expect.arrayContaining([unassigned.id, mine.id]));
        expect(ids).not.toContain(foreign.id);
    });

    test("list() filters by status", async () => {
        await createRequest();
        const request2 = await createRequest({ title: "Another request" });

        await Request.setStatus(request2.id, Request.Status.IN_PROGRESS);

        const result = await listAsAdmin({
            status: Request.Status.IN_PROGRESS,
        });

        expect(result.requests).toMatchObject([
            {
                id: request2.id,
                status: Request.Status.IN_PROGRESS,
            },
        ]);
        expect(result.requests).toHaveLength(1);
    });

    test("list() rejects invalid status filter", async () => {
        await expect(listAsAdmin({ status: "invalid" })).rejects.toThrow(
            "Invalid status",
        );
    });

    test("list() filters by category_id", async () => {
        const category2 = await Category.add("category2");
        await createRequest();
        const request2 = await createRequest({
            category_id: category2.id,
        });

        const result = await listAsAdmin({
            category_id: category2.id,
        });

        expect(result.requests).toMatchObject([{ id: request2.id }]);
        expect(result.requests).toHaveLength(1);
    });

    test("list() filters by assigned_operator_id", async () => {
        await createRequest();
        const request2 = await createRequest({ title: "Assigned request" });

        await Request.assignOperator(request2.id, operator.id);

        const result = await listAsAdmin({
            assigned_operator_id: operator.id,
        });

        expect(result.requests).toMatchObject([
            {
                id: request2.id,
                assigned_operator_id: operator.id,
            },
        ]);
        expect(result.requests).toHaveLength(1);
    });

    test("list() filters by date range", async () => {
        await createRequest();

        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86_400_000)
            .toISOString()
            .slice(0, 10);
        const tomorrow = new Date(Date.now() + 86_400_000)
            .toISOString()
            .slice(0, 10);

        expect(
            (await listAsAdmin({ date_from: tomorrow })).requests,
        ).toHaveLength(0);

        expect(
            (await listAsAdmin({ date_to: yesterday })).requests,
        ).toHaveLength(0);

        expect(
            (
                await listAsAdmin({
                    date_from: today,
                    date_to: today,
                })
            ).requests,
        ).toHaveLength(1);

        expect(
            (
                await listAsAdmin({
                    date_from: yesterday,
                    date_to: tomorrow,
                })
            ).requests,
        ).toHaveLength(1);
    });

    test("list() searches by title", async () => {
        const request1 = await createRequest({
            title: "Printer is broken",
        });
        await createRequest({ title: "Network problem" });

        const result = await listAsAdmin({ search: "printer" });

        expect(result.requests).toMatchObject([{ id: request1.id }]);
        expect(result.requests).toHaveLength(1);
    });

    test("list() searches by description", async () => {
        const request1 = await createRequest({
            description: "Cannot connect to the server",
        });
        await createRequest({
            description: "Printer does not work",
        });

        const result = await listAsAdmin({ search: "server" });

        expect(result.requests).toMatchObject([{ id: request1.id }]);
        expect(result.requests).toHaveLength(1);
    });

    test("list() sorts requests by title ascending", async () => {
        await createRequest({ title: "Zebra" });
        await createRequest({ title: "Apple" });
        await createRequest({ title: "Middle" });

        const result = await listAsAdmin({
            sort_by: "title",
            sort_order: "asc",
        });

        expect(result.requests.map((request) => request.title)).toEqual([
            "Apple",
            "Middle",
            "Zebra",
        ]);
    });

    test("list() paginates requests", async () => {
        await createRequest({ title: "First" });
        await createRequest({ title: "Second" });
        await createRequest({ title: "Third" });

        const result = await listAsAdmin({
            page: 2,
            limit: 2,
            sort_by: "title",
            sort_order: "asc",
        });

        expect(result.requests).toHaveLength(1);
        expect(result.requests[0].title).toBe("Third");
        expect(result.pagination).toMatchObject({
            page: 2,
            limit: 2,
            total: 3,
            totalPages: 2,
        });
    });

    test("list() returns empty requests when page exceeds total pages", async () => {
        await createRequest();

        const result = await listAsAdmin({ page: 2 });

        expect(result.requests).toHaveLength(0);
        expect(result.pagination.total).toBe(1);
    });

    test("list() throws for an unknown user role", async () => {
        await expect(
            Request.list({ user: { id: 1, role: "guest" } }),
        ).rejects.toThrow("Invalid user role");
    });

    test("list() uses default sorting when sort_by is unknown", async () => {
        await createRequest({ title: "First" });
        await createRequest({ title: "Second" });

        const result = await listAsAdmin({ sort_by: "password" });

        expect(result.requests.map((r) => r.title)).toEqual([
            "Second",
            "First",
        ]);
    });

    test("list() sorts ascending when asked", async () => {
        await createRequest({ title: "First" });
        await createRequest({ title: "Second" });

        const result = await listAsAdmin({ sort_by: "id", sort_order: "asc" });

        expect(result.requests.map((r) => r.title)).toEqual([
            "First",
            "Second",
        ]);
    });

    test("list() works without any arguments except the user", async () => {
        const result = await listAsAdmin();
        expect(result.requests).toEqual([]);
        expect(result.pagination).toEqual({
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
        });
    });
});
