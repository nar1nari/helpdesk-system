const request = require("supertest");
const createApp = require("../helpers/createApp");
const createAuthHelpers = require("../helpers/authHelpers");

describe("Categories API", () => {
    let app;
    let signUp;
    let auth;

    beforeEach(() => {
        app = createApp();
        ({ signUp, auth } = createAuthHelpers(app));
    });

    describe("GET /categories", () => {
        test("get a list of categories", async () => {
            const alice = await signUp("alice");
            const res = await request(app)
                .get("/categories")
                .set(auth(alice.token))
                .send();
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ categories: [] });
        });
    });
});
