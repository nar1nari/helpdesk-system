const request = require("supertest");
const createApp = require("../helpers/createApp");
const createAuthHelpers = require("../helpers/authHelpers");
const Category = require("../../src/models/category");
const Request = require("../../src/models/requests");

describe("Categories API", () => {
    let app;
    let signUp;
    let auth;
    let admin;
    let alice;

    beforeEach(async () => {
        app = createApp();
        ({ signUp, auth } = createAuthHelpers(app));
        admin = await signUp("admin1", "admin");
        alice = await signUp("alice");
    });

    describe("GET /categories", () => {
        test("401 without token", async () => {
            const res = await request(app).get("/categories");
            expect(res.status).toBe(401);
        });

        test("get a list of categories", async () => {
            const res = await request(app)
                .get("/categories")
                .set(auth(alice.token))
                .send();
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ categories: [] });
        });

        test("returns existing categories", async () => {
            await Category.add("Hardware");
            await Category.add("Software");
            const res = await request(app)
                .get("/categories")
                .set(auth(alice.token));
            expect(res.body.categories.map((c) => c.name)).toEqual([
                "Hardware",
                "Software",
            ]);
        });
    });

    describe("POST /categories", () => {
        const create = (token, body) =>
            request(app).post("/categories").set(auth(token)).send(body);

        test("403 for a non-admin", async () => {
            const res = await create(alice.token, { name: "Hardware" });
            expect(res.status).toBe(403);
        });

        test("admin creates a category", async () => {
            const res = await create(admin.token, { name: "Hardware" });
            expect(res.status).toBe(201);
            expect(res.body.category).toEqual({
                id: expect.any(Number),
                name: "Hardware",
            });
        });

        test("400 for an empty name", async () => {
            const res = await create(admin.token, { name: "  " });
            expect(res.status).toBe(400);
        });

        test("409 for a duplicate name", async () => {
            await create(admin.token, { name: "Hardware" });
            const res = await create(admin.token, { name: "Hardware" });
            expect(res.status).toBe(409);
        });
    });

    describe("PATCH /categories/:id", () => {
        const rename = (token, id, name) =>
            request(app)
                .patch(`/categories/${id}`)
                .set(auth(token))
                .send({ name });

        test("403 for a non-admin", async () => {
            const category = await Category.add("Hardware");
            const res = await rename(alice.token, category.id, "New");
            expect(res.status).toBe(403);
        });

        test("admin renames a category", async () => {
            const category = await Category.add("Hardware");
            const res = await rename(admin.token, category.id, "Devices");
            expect(res.status).toBe(200);
            expect(res.body.category).toEqual({
                id: category.id,
                name: "Devices",
            });
        });

        test("404 for an unknown category", async () => {
            const res = await rename(admin.token, 99999, "Devices");
            expect(res.status).toBe(404);
        });

        test("409 when the new name is already used", async () => {
            await Category.add("Hardware");
            const other = await Category.add("Software");
            const res = await rename(admin.token, other.id, "Hardware");
            expect(res.status).toBe(409);
        });
    });

    describe("DELETE /categories/:id", () => {
        const remove = (token, id) =>
            request(app).delete(`/categories/${id}`).set(auth(token));

        test("403 for a non-admin", async () => {
            const category = await Category.add("Hardware");
            const res = await remove(alice.token, category.id);
            expect(res.status).toBe(403);
        });

        test("admin deletes a category without sending a body", async () => {
            const category = await Category.add("Hardware");
            const res = await remove(admin.token, category.id);
            expect(res.status).toBe(200);
            expect(res.body.category).toEqual({
                id: category.id,
                name: "Hardware",
            });
            expect(await Category.findById(category.id)).toBeUndefined();
        });

        test("404 for an unknown category", async () => {
            const res = await remove(admin.token, 99999);
            expect(res.status).toBe(404);
        });

        test("409 when requests still use the category", async () => {
            const category = await Category.add("Hardware");
            await Request.create(alice.user.id, category.id, "Title", "Text");
            const res = await remove(admin.token, category.id);
            expect(res.status).toBe(409);
        });
    });
});
