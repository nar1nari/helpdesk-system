const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../../src/db");
const Category = require("../../src/models/category");
const RequestModel = require("../../src/models/requests");
const Notification = require("../../src/models/notifications");
const createAuthHelpers = require("../helpers/authHelpers");
const { cleanupUploads } = require("../helpers/uploads");

describe("Notifications", () => {
    let app;
    let category;
    let signUp;
    let auth;
    let alice;
    let olga;
    let admin;
    let created;

    cleanupUploads();

    beforeEach(async () => {
        app = createApp();
        ({ signUp, auth } = createAuthHelpers(app));
        category = await Category.add("category1");
        alice = await signUp("alice");
        olga = await signUp("olga", "operator");
        admin = await signUp("admin", "admin");
        created = await RequestModel.create(
            alice.user.id,
            category.id,
            "Printer is broken",
            "Test description",
        );
        await RequestModel.assignOperator(created.id, olga.user.id);
    });

    const forUser = async (user) =>
        (
            await db.query(
                "SELECT * FROM notifications WHERE user_id = $1 ORDER BY id",
                [user.id],
            )
        ).rows;

    const inbox = (token, query = "") =>
        request(app).get(`/notifications${query}`).set(auth(token));

    const patchStatus = (token, status) =>
        request(app)
            .patch(`/requests/${created.id}/status`)
            .set(auth(token))
            .send({ status });

    const comment = (token, content = "hello") =>
        request(app)
            .post(`/requests/${created.id}/comments`)
            .set(auth(token))
            .send({ content });

    const upload = (token, name = "log.txt") =>
        request(app)
            .post(`/requests/${created.id}/attachments`)
            .set(auth(token))
            .attach("file", Buffer.from("data"), name);

    describe("triggers", () => {
        test("a status change by the operator notifies the applicant only", async () => {
            const res = await patchStatus(olga.token, "in_progress");
            expect(res.status).toBe(200);

            const [n, ...rest] = await forUser(alice.user);
            expect(rest).toEqual([]);
            expect(n).toMatchObject({
                request_id: created.id,
                actor_id: olga.user.id,
                type: "status_changed",
                meta: { old_status: "new", new_status: "in_progress" },
                is_read: false,
            });
            expect(await forUser(olga.user)).toEqual([]);
            expect(await forUser(admin.user)).toEqual([]);
        });

        test("a status change by the applicant notifies the operator", async () => {
            await RequestModel.setStatus(created.id, "resolved");

            await patchStatus(alice.token, "closed");

            expect(await forUser(alice.user)).toEqual([]);
            expect(await forUser(olga.user)).toMatchObject([
                {
                    type: "status_changed",
                    actor_id: alice.user.id,
                    meta: { old_status: "resolved", new_status: "closed" },
                },
            ]);
        });

        test("an administrator's change notifies both the applicant and the operator", async () => {
            await patchStatus(admin.token, "in_progress");

            expect(await forUser(alice.user)).toHaveLength(1);
            expect(await forUser(olga.user)).toHaveLength(1);
            expect(await forUser(admin.user)).toEqual([]);
        });

        test("a failed status change creates no notification", async () => {
            const res = await patchStatus(olga.token, "closed");
            expect(res.status).toBe(409);
            expect(await forUser(alice.user)).toEqual([]);
        });

        test("a comment from the applicant notifies the operator", async () => {
            const res = await comment(alice.token, "any news?");
            expect(res.status).toBe(201);

            expect(await forUser(olga.user)).toMatchObject([
                {
                    type: "comment_added",
                    actor_id: alice.user.id,
                    request_id: created.id,
                },
            ]);
            expect(await forUser(alice.user)).toEqual([]);
        });

        test("a comment from the operator notifies the applicant", async () => {
            await comment(olga.token);
            expect(await forUser(alice.user)).toMatchObject([
                { type: "comment_added", actor_id: olga.user.id },
            ]);
        });

        test("the comment text is not copied into the notification", async () => {
            await comment(olga.token, "secret text");
            const [n] = await forUser(alice.user);
            expect(JSON.stringify(n)).not.toContain("secret text");
        });

        test("a rejected comment creates no notification", async () => {
            await RequestModel.setStatus(created.id, "closed");
            const res = await comment(olga.token);
            expect(res.status).toBe(409);
            expect(await forUser(alice.user)).toEqual([]);
        });

        test("an uploaded file notifies the other party, with its name", async () => {
            const res = await upload(alice.token, "screenshot.txt");
            expect(res.status).toBe(201);

            expect(await forUser(olga.user)).toMatchObject([
                {
                    type: "file_added",
                    actor_id: alice.user.id,
                    meta: { original_name: "screenshot.txt" },
                },
            ]);
            expect(await forUser(alice.user)).toEqual([]);
        });

        test("hiding a comment or a file notifies the other party", async () => {
            const c = await comment(alice.token);
            const f = await upload(alice.token, "a.txt");
            await db.query("DELETE FROM notifications");

            await request(app)
                .delete(`/requests/${created.id}/comments/${c.body.comment.id}`)
                .set(auth(alice.token));
            await request(app)
                .delete(`/attachments/${f.body.attachment.id}`)
                .set(auth(alice.token));

            expect(await forUser(olga.user)).toMatchObject([
                { type: "comment_deleted", actor_id: alice.user.id },
                {
                    type: "file_deleted",
                    actor_id: alice.user.id,
                    meta: { original_name: "a.txt" },
                },
            ]);
            expect(await forUser(alice.user)).toEqual([]);
        });

        test("an administrator hiding someone's comment notifies both parties", async () => {
            const c = await comment(alice.token);
            await db.query("DELETE FROM notifications");

            await request(app)
                .delete(`/requests/${created.id}/comments/${c.body.comment.id}`)
                .set(auth(admin.token));

            expect(await forUser(alice.user)).toHaveLength(1);
            expect(await forUser(olga.user)).toHaveLength(1);
        });

        test("an unassigned request notifies only the applicant", async () => {
            await RequestModel.assignOperator(created.id, null);
            await patchStatus(admin.token, "rejected");

            expect(await forUser(alice.user)).toHaveLength(1);
            expect(await forUser(olga.user)).toEqual([]);
        });

        test("an applicant commenting on an unassigned request notifies nobody", async () => {
            await RequestModel.assignOperator(created.id, null);
            await comment(alice.token);
            expect(
                (await db.query("SELECT 1 FROM notifications")).rowCount,
            ).toBe(0);
        });

        test("deactivated users are not notified", async () => {
            await db.query("UPDATE users SET is_active = false WHERE id = $1", [
                alice.user.id,
            ]);
            await patchStatus(olga.token, "in_progress");
            expect(await forUser(alice.user)).toEqual([]);
        });

        test("a failure while notifying does not fail the action", async () => {
            const spy = jest
                .spyOn(Notification, "createMany")
                .mockRejectedValue(new Error("boom"));
            const errors = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});

            const res = await patchStatus(olga.token, "in_progress");

            expect(res.status).toBe(200);
            expect(res.body.request.status).toBe("in_progress");
            expect(errors).toHaveBeenCalled();
            spy.mockRestore();
            errors.mockRestore();
        });
    });

    describe("GET /notifications", () => {
        test("401 without token", async () => {
            expect((await request(app).get("/notifications")).status).toBe(401);
        });

        test("returns only the caller's notifications, newest first", async () => {
            await patchStatus(olga.token, "in_progress");
            await comment(olga.token);
            await comment(alice.token);

            const res = await inbox(alice.token);

            expect(res.status).toBe(200);
            expect(res.body.notifications.map((n) => n.type)).toEqual([
                "comment_added",
                "status_changed",
            ]);
            expect(res.body.unread_count).toBe(2);
            expect(res.body.notifications[0]).toMatchObject({
                request_id: created.id,
                request_title: "Printer is broken",
                actor: { id: olga.user.id, username: "olga" },
                is_read: false,
            });
            expect(res.body.notifications[0]).not.toHaveProperty("user_id");
            expect(res.body.notifications[0]).not.toHaveProperty("actor_id");
        });

        test("filters unread and paginates", async () => {
            for (let i = 0; i < 3; i++) await comment(olga.token, `c${i}`);
            const [first] = await forUser(alice.user);
            await request(app)
                .patch(`/notifications/${first.id}/read`)
                .set(auth(alice.token));

            const unread = await inbox(alice.token, "?unread=true");
            expect(unread.body.notifications).toHaveLength(2);
            expect(unread.body.unread_count).toBe(2);

            const page = await inbox(alice.token, "?limit=2&page=2");
            expect(page.body.notifications).toHaveLength(1);
            expect(page.body.pagination).toEqual({
                page: 2,
                limit: 2,
                total: 3,
                totalPages: 2,
            });
        });

        test("400 for invalid query parameters", async () => {
            expect((await inbox(alice.token, "?unread=maybe")).status).toBe(
                400,
            );
            expect((await inbox(alice.token, "?limit=0")).status).toBe(400);
        });

        test("notifications of a hidden request are not shown or counted", async () => {
            await patchStatus(olga.token, "in_progress");
            await request(app)
                .delete(`/requests/${created.id}`)
                .set(auth(alice.token));

            const res = await inbox(alice.token);

            expect(res.body.notifications).toEqual([]);
            expect(res.body.unread_count).toBe(0);
            expect(res.body.pagination.total).toBe(0);
        });
    });

    describe("PATCH /notifications/:id/read", () => {
        const markRead = (token, id) =>
            request(app).patch(`/notifications/${id}/read`).set(auth(token));

        test("401 without token", async () => {
            expect(
                (await request(app).patch("/notifications/1/read")).status,
            ).toBe(401);
        });

        test("marks the caller's notification as read", async () => {
            await comment(olga.token);
            const [n] = await forUser(alice.user);

            const res = await markRead(alice.token, n.id);

            expect(res.status).toBe(200);
            expect(res.body.notification).toMatchObject({
                id: n.id,
                is_read: true,
            });
            expect((await inbox(alice.token)).body.unread_count).toBe(0);
        });

        test("404 for someone else's notification, which stays unread", async () => {
            await comment(olga.token);
            const [n] = await forUser(alice.user);

            expect((await markRead(olga.token, n.id)).status).toBe(404);
            expect((await forUser(alice.user))[0].is_read).toBe(false);
        });

        test("404 for an unknown notification and 400 for a bad id", async () => {
            expect((await markRead(alice.token, 999)).status).toBe(404);
            expect((await markRead(alice.token, "x")).status).toBe(400);
        });
    });

    describe("POST /notifications/read-all", () => {
        test("marks only the caller's notifications as read", async () => {
            await comment(olga.token);
            await comment(alice.token);

            const res = await request(app)
                .post("/notifications/read-all")
                .set(auth(alice.token));

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ updated: 1 });
            expect((await inbox(alice.token)).body.unread_count).toBe(0);
            expect((await inbox(olga.token)).body.unread_count).toBe(1);
        });

        test("401 without token", async () => {
            expect(
                (await request(app).post("/notifications/read-all")).status,
            ).toBe(401);
        });
    });
});
