const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../../src/db");
const Category = require("../../src/models/category");
const RequestModel = require("../../src/models/requests");
const Comment = require("../../src/models/comments");
const createAuthHelpers = require("../helpers/authHelpers");
const {
    cleanupUploads,
    addAttachment,
    fileExists,
} = require("../helpers/uploads");

describe("Deleting (hiding) requests, comments and files", () => {
    let app;
    let category;
    let signUp;
    let auth;

    cleanupUploads();

    beforeEach(async () => {
        app = createApp();
        ({ signUp, auth } = createAuthHelpers(app));
        category = await Category.add("category1");
    });

    const createRequestFor = (user, title = "Test request") =>
        RequestModel.create(user.id, category.id, title, "Test description");

    const row = async (table, id) =>
        (await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id])).rows[0];

    describe("DELETE /requests/:id", () => {
        const del = (token, id) =>
            request(app).delete(`/requests/${id}`).set(auth(token));

        test("401 without token", async () => {
            const res = await request(app).delete("/requests/1");
            expect(res.status).toBe(401);
        });

        test("400 for an invalid id", async () => {
            const alice = await signUp("alice");
            expect((await del(alice.token, "abc")).status).toBe(400);
        });

        test("404 for an unknown request", async () => {
            const alice = await signUp("alice");
            expect((await del(alice.token, 999)).status).toBe(404);
        });

        test("the author can hide their own request", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            const res = await del(alice.token, created.id);

            expect(res.status).toBe(204);
            const stored = await row("requests", created.id);
            expect(stored.deleted_at).toBeInstanceOf(Date);
            expect(stored.deleted_by).toBe(alice.user.id);
        });

        test("a hidden request disappears from get, list and sub-resources", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            await createRequestFor(alice.user, "Another");
            await del(alice.token, created.id);

            const get = await request(app)
                .get(`/requests/${created.id}`)
                .set(auth(alice.token));
            const list = await request(app)
                .get("/requests")
                .set(auth(alice.token));
            const comments = await request(app)
                .get(`/requests/${created.id}/comments`)
                .set(auth(alice.token));
            const attachments = await request(app)
                .get(`/requests/${created.id}/attachments`)
                .set(auth(alice.token));

            expect(get.status).toBe(404);
            expect(list.body.requests.map((r) => r.title)).toEqual(["Another"]);
            expect(list.body.pagination.total).toBe(1);
            expect(comments.status).toBe(404);
            expect(attachments.status).toBe(404);
        });

        test("a hidden request disappears from the admin's list too", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequestFor(alice.user);
            await del(alice.token, created.id);

            const list = await request(app)
                .get("/requests")
                .set(auth(admin.token));

            expect(list.body.requests).toEqual([]);
        });

        test("hidden request files can no longer be downloaded", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            const file = await addAttachment(created.id, {
                uploadedBy: alice.user.id,
            });
            await del(alice.token, created.id);

            const res = await request(app)
                .get(`/attachments/${file.id}`)
                .set(auth(alice.token));

            expect(res.status).toBe(404);
        });

        test("an administrator can hide anyone's request", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequestFor(alice.user);

            const res = await del(admin.token, created.id);

            expect(res.status).toBe(204);
            expect((await row("requests", created.id)).deleted_by).toBe(
                admin.user.id,
            );
        });

        test("404 for an applicant who does not own the request", async () => {
            const alice = await signUp("alice");
            const bob = await signUp("bob");
            const created = await createRequestFor(alice.user);

            expect((await del(bob.token, created.id)).status).toBe(404);
            expect((await row("requests", created.id)).deleted_at).toBeNull();
        });

        test("403 for the assigned operator who is not the author", async () => {
            const alice = await signUp("alice");
            const olga = await signUp("olga", "operator");
            const created = await createRequestFor(alice.user);
            await RequestModel.assignOperator(created.id, olga.user.id);

            expect((await del(olga.token, created.id)).status).toBe(403);
            expect((await row("requests", created.id)).deleted_at).toBeNull();
        });

        test("403 for an operator looking at an unassigned request", async () => {
            const alice = await signUp("alice");
            const olga = await signUp("olga", "operator");
            const created = await createRequestFor(alice.user);

            expect((await del(olga.token, created.id)).status).toBe(403);
        });

        test("an operator can hide a request they authored themselves", async () => {
            const olga = await signUp("olga", "operator");
            const created = await createRequestFor(olga.user);

            expect((await del(olga.token, created.id)).status).toBe(204);
        });

        test("404 when the request is already hidden", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            await del(alice.token, created.id);

            expect((await del(alice.token, created.id)).status).toBe(404);
        });
    });

    describe("DELETE /requests/:id/comments/:commentId", () => {
        const del = (token, requestId, commentId) =>
            request(app)
                .delete(`/requests/${requestId}/comments/${commentId}`)
                .set(auth(token));

        const listComments = (token, requestId) =>
            request(app)
                .get(`/requests/${requestId}/comments`)
                .set(auth(token));

        test("401 without token", async () => {
            const res = await request(app).delete("/requests/1/comments/1");
            expect(res.status).toBe(401);
        });

        test("400 for an invalid comment id", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            expect((await del(alice.token, created.id, "x")).status).toBe(400);
        });

        test("the author can hide their own comment", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            const keep = await Comment.create(
                created.id,
                alice.user.id,
                "keep",
            );
            const gone = await Comment.create(
                created.id,
                alice.user.id,
                "gone",
            );

            const res = await del(alice.token, created.id, gone.id);

            expect(res.status).toBe(204);
            const list = await listComments(alice.token, created.id);
            expect(list.body.comments.map((c) => c.id)).toEqual([keep.id]);

            const stored = await row("request_comments", gone.id);
            expect(stored.content).toBe("gone");
            expect(stored.deleted_at).toBeInstanceOf(Date);
            expect(stored.deleted_by).toBe(alice.user.id);
        });

        test("an administrator can hide anyone's comment", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequestFor(alice.user);
            const comment = await Comment.create(
                created.id,
                alice.user.id,
                "x",
            );

            expect(
                (await del(admin.token, created.id, comment.id)).status,
            ).toBe(204);
            expect((await row("request_comments", comment.id)).deleted_by).toBe(
                admin.user.id,
            );
        });

        test("403 when the applicant tries to hide the operator's comment", async () => {
            const alice = await signUp("alice");
            const olga = await signUp("olga", "operator");
            const created = await createRequestFor(alice.user);
            await RequestModel.assignOperator(created.id, olga.user.id);
            const comment = await Comment.create(created.id, olga.user.id, "x");

            const res = await del(alice.token, created.id, comment.id);

            expect(res.status).toBe(403);
            expect(
                (await listComments(alice.token, created.id)).body.comments,
            ).toHaveLength(1);
        });

        test("403 when the operator tries to hide the applicant's comment", async () => {
            const alice = await signUp("alice");
            const olga = await signUp("olga", "operator");
            const created = await createRequestFor(alice.user);
            await RequestModel.assignOperator(created.id, olga.user.id);
            const comment = await Comment.create(
                created.id,
                alice.user.id,
                "x",
            );

            expect((await del(olga.token, created.id, comment.id)).status).toBe(
                403,
            );
        });

        test("404 for a user who cannot see the request", async () => {
            const alice = await signUp("alice");
            const bob = await signUp("bob");
            const created = await createRequestFor(alice.user);
            const comment = await Comment.create(
                created.id,
                alice.user.id,
                "x",
            );

            expect((await del(bob.token, created.id, comment.id)).status).toBe(
                404,
            );
        });

        test("404 for an unknown comment", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            expect((await del(alice.token, created.id, 999)).status).toBe(404);
        });

        test("404 when the comment belongs to a different request", async () => {
            const alice = await signUp("alice");
            const first = await createRequestFor(alice.user, "first");
            const second = await createRequestFor(alice.user, "second");
            const comment = await Comment.create(second.id, alice.user.id, "x");

            expect((await del(alice.token, first.id, comment.id)).status).toBe(
                404,
            );
            expect((await row("request_comments", comment.id)).deleted_at).toBe(
                null,
            );
        });

        test("404 when the comment is already hidden", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            const comment = await Comment.create(
                created.id,
                alice.user.id,
                "x",
            );
            await del(alice.token, created.id, comment.id);

            expect(
                (await del(alice.token, created.id, comment.id)).status,
            ).toBe(404);
        });

        test("hiding a comment is still allowed on a closed request", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            const comment = await Comment.create(
                created.id,
                alice.user.id,
                "x",
            );
            await RequestModel.setStatus(created.id, "rejected");

            expect(
                (await del(alice.token, created.id, comment.id)).status,
            ).toBe(204);
        });
    });

    describe("DELETE /attachments/:id", () => {
        const del = (token, id) =>
            request(app).delete(`/attachments/${id}`).set(auth(token));

        test("401 without token", async () => {
            const res = await request(app).delete("/attachments/1");
            expect(res.status).toBe(401);
        });

        test("400 for an invalid id", async () => {
            const alice = await signUp("alice");
            expect((await del(alice.token, "abc")).status).toBe(400);
        });

        test("404 for an unknown attachment", async () => {
            const alice = await signUp("alice");
            expect((await del(alice.token, 999)).status).toBe(404);
        });

        test("the uploader can hide their own file", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            const keep = await addAttachment(created.id, {
                name: "keep.txt",
                uploadedBy: alice.user.id,
            });
            const gone = await addAttachment(created.id, {
                name: "gone.txt",
                uploadedBy: alice.user.id,
            });

            const res = await del(alice.token, gone.id);

            expect(res.status).toBe(204);
            const list = await request(app)
                .get(`/requests/${created.id}/attachments`)
                .set(auth(alice.token));
            expect(list.body.attachments.map((a) => a.id)).toEqual([keep.id]);

            const download = await request(app)
                .get(`/attachments/${gone.id}`)
                .set(auth(alice.token));
            expect(download.status).toBe(404);

            const stored = await row("request_attachments", gone.id);
            expect(stored.deleted_at).toBeInstanceOf(Date);
            expect(stored.deleted_by).toBe(alice.user.id);
            expect(await fileExists(gone)).toBe(true);
        });

        test("uploads made through the API record the uploader", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            const up = await request(app)
                .post(`/requests/${created.id}/attachments`)
                .set(auth(alice.token))
                .attach("file", Buffer.from("data"), "a.txt");

            expect(up.status).toBe(201);
            expect(up.body.attachment.uploaded_by).toBe(alice.user.id);
            const list = await request(app)
                .get(`/requests/${created.id}/attachments`)
                .set(auth(alice.token));
            expect(list.body.attachments[0].uploaded_by).toBe(alice.user.id);
            expect(
                (await row("request_attachments", up.body.attachment.id))
                    .uploaded_by,
            ).toBe(alice.user.id);
            expect((await del(alice.token, up.body.attachment.id)).status).toBe(
                204,
            );
        });

        test("an administrator can hide anyone's file", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequestFor(alice.user);
            const file = await addAttachment(created.id, {
                uploadedBy: alice.user.id,
            });

            expect((await del(admin.token, file.id)).status).toBe(204);
            expect((await row("request_attachments", file.id)).deleted_by).toBe(
                admin.user.id,
            );
        });

        test("403 when the applicant tries to hide the operator's file", async () => {
            const alice = await signUp("alice");
            const olga = await signUp("olga", "operator");
            const created = await createRequestFor(alice.user);
            await RequestModel.assignOperator(created.id, olga.user.id);
            const file = await addAttachment(created.id, {
                uploadedBy: olga.user.id,
            });

            expect((await del(alice.token, file.id)).status).toBe(403);
            expect(
                (await row("request_attachments", file.id)).deleted_at,
            ).toBeNull();
        });

        test("403 when the operator tries to hide the applicant's file", async () => {
            const alice = await signUp("alice");
            const olga = await signUp("olga", "operator");
            const created = await createRequestFor(alice.user);
            await RequestModel.assignOperator(created.id, olga.user.id);
            const file = await addAttachment(created.id, {
                uploadedBy: alice.user.id,
            });

            expect((await del(olga.token, file.id)).status).toBe(403);
        });

        test("a file with an unknown uploader can only be hidden by an administrator", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequestFor(alice.user);
            const file = await addAttachment(created.id);

            expect((await del(alice.token, file.id)).status).toBe(403);
            expect((await del(admin.token, file.id)).status).toBe(204);
        });

        test("404 for a user who cannot see the request", async () => {
            const alice = await signUp("alice");
            const bob = await signUp("bob");
            const created = await createRequestFor(alice.user);
            const file = await addAttachment(created.id, {
                uploadedBy: alice.user.id,
            });

            expect((await del(bob.token, file.id)).status).toBe(404);
        });

        test("404 when the request is hidden", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequestFor(alice.user);
            const file = await addAttachment(created.id, {
                uploadedBy: alice.user.id,
            });
            await RequestModel.softDelete(created.id, admin.user.id);

            expect((await del(alice.token, file.id)).status).toBe(404);
        });

        test("404 when the file is already hidden", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            const file = await addAttachment(created.id, {
                uploadedBy: alice.user.id,
            });
            await del(alice.token, file.id);

            expect((await del(alice.token, file.id)).status).toBe(404);
        });
    });
});
