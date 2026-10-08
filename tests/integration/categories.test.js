const request = require("supertest");
const jwt = require("jsonwebtoken");
const createApp = require("../helpers/createApp");

describe("Categories API", () => {
    let app;

    beforeEach(() => {
        app = createApp();
    });

    describe("GET /categories", () => {
        test("get a list of categories", async () => {
            const res = await request(app).get("/categories").send();
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ categories: [] });
        });
    });
});
