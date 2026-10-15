const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../../src/db");
const Category = require("../../src/models/categories");
const Request = require("../../src/models/requests");
const Comment = require("../../src/models/comments");
const createAuthHelpers = require("../helpers/authHelpers");

describe("Comments API", () => {
    let app;
    let category;
    let signUp;
    let auth;

    beforeEach(async () => {
        app = createApp();
        ({ signUp, auth } = createAuthHelpers(app));
        category = await Category.add("category1");
    });

    const createRequestFor = (user) =>
        Request.create(
            user.id,
            category.id,
            "Test request",
            "Test description",
        );

    const sendComment = (token, request_id, message = "Test comment") =>
        request(app)
            .post(`/requests/${request_id}/comments`)
            .set(auth(token))
            .send({ message });

    const addComment = async (
        request_id,
        user_id,
        message = "Test comment",
    ) => {
        return await Comment.create(request_id, user_id, message);
    };

    describe("POST /requests/:id/comments", () => {
        test("401 without token", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            const res = await request(app)
                .post(`/requests/${created.id}/comments`)
                .send({ message: "Test comment" });

            expect(res.status).toBe(401);
        });

        test("401 for a valid token of a deleted user", async () => {
            const ghost = await signUp("ghost");
            const created = await createRequestFor(ghost.user);
            await db.query("DELETE FROM requests WHERE id = $1", [created.id]);
            await db.query("DELETE FROM users WHERE username = $1", ["ghost"]);

            const res = await sendComment(ghost.token, created.id);

            expect(res.status).toBe(401);
        });

        test("404 for unknown request", async () => {
            const alice = await signUp("alice");

            const res = await sendComment(alice.token, 42);

            expect(res.status).toBe(404);
        });

        test("403 when applicant is not the request owner", async () => {
            const alice = await signUp("alice");
            const other = await signUp("other", "applicant");
            const created = await createRequestFor(alice.user);

            const res = await sendComment(other.token, created.id);

            expect(res.status).toBe(403);
        });

        test.each(["operator", "admin"])(
            "uploads a comment when %s is not the request owner",
            async (role) => {
                const alice = await signUp("alice");
                const other = await signUp("other", role);
                const created = await createRequestFor(alice.user);

                const res = await sendComment(other.token, created.id);

                expect(res.status).toBe(200);
            },
        );

        test("400 when no message is uploaded", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            const res = await request(app)
                .post(`/requests/${created.id}/comments`)
                .set(auth(alice.token));

            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe("Message is required");
        });

        test("uploads a comment to own request", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            const res = await sendComment(alice.token, created.id);

            expect(res.status).toBe(200);
            expect(res.body.comment).toMatchObject({
                id: expect.any(Number),
                request_id: created.id,
                author_id: alice.user.id,
                content: "Test comment",
                created_at: expect.any(String),
            });
        });
    });

    describe("GET /requests/:id/comments", () => {
        test("401 without token", async () => {
            const res = await request(app).get("/requests/1/comments");
            expect(res.status).toBe(401);
        });

        test("401 for a valid token of a deleted user", async () => {
            const ghost = await signUp("ghost");
            await db.query("DELETE FROM users WHERE username = $1", ["ghost"]);

            const res = await request(app)
                .get("/requests/1/comments")
                .set(auth(ghost.token));

            expect(res.status).toBe(401);
        });

        test("gets a list of comments", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            const comment = await addComment(created.id, alice.user.id);

            const res = await request(app)
                .get(`/requests/${created.id}/comments`)
                .set(auth(alice.token));

            expect(res.status).toBe(200);
            expect(res.text).toEqual(JSON.stringify({ comments: [comment] }));
        });

        test("403 when applicant opens comments of someone else's request", async () => {
            const alice = await signUp("alice");
            const bob = await signUp("bob");
            const created = await createRequestFor(alice.user);
            await addComment(created.id, alice.user.id);

            const res = await request(app)
                .get(`/requests/${created.id}/comments`)
                .set(auth(bob.token));

            expect(res.status).toBe(403);
        });

        test("admin can view any comments", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequestFor(alice.user);
            const comment = await addComment(created.id, alice.user.id);

            const res = await request(app)
                .get(`/requests/${created.id}/comments`)
                .set(auth(admin.token));

            expect(res.status).toBe(200);
            expect(res.text).toEqual(JSON.stringify({ comments: [comment] }));
        });
    });
});
