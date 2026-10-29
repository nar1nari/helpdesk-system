const db = require("../../src/db");
const User = require("../../src/models/users");
const Category = require("../../src/models/category");
const RequestModel = require("../../src/models/requests");
const Comment = require("../../src/models/comments");
const Attachment = require("../../src/models/attachments");
const { cleanupUploads, addAttachment } = require("../helpers/uploads");

describe("Soft deletion in the models", () => {
    let alice;
    let admin;
    let request;

    cleanupUploads();

    beforeEach(async () => {
        alice = await User.create("alice", "secret123");
        admin = await User.create("admin", "secret123", "admin");
        const category = await Category.add("category1");
        request = await RequestModel.create(
            alice.id,
            category.id,
            "Test request",
            "Test description",
        );
    });

    describe("RequestModel", () => {
        test("softDelete() hides the request but keeps the row", async () => {
            const hidden = await RequestModel.softDelete(request.id, admin.id);

            expect(hidden).toMatchObject({
                id: request.id,
                deleted_at: expect.any(Date),
                deleted_by: admin.id,
            });
            expect(await RequestModel.get(request.id)).toBeUndefined();
            const { rowCount } = await db.query(
                "SELECT 1 FROM requests WHERE id = $1",
                [request.id],
            );
            expect(rowCount).toBe(1);
        });

        test("softDelete() returns undefined for unknown or already hidden requests", async () => {
            expect(
                await RequestModel.softDelete(999, admin.id),
            ).toBeUndefined();
            await RequestModel.softDelete(request.id, admin.id);
            expect(
                await RequestModel.softDelete(request.id, alice.id),
            ).toBeUndefined();
            const { rows } = await db.query(
                "SELECT deleted_by FROM requests WHERE id = $1",
                [request.id],
            );
            expect(rows[0].deleted_by).toBe(admin.id);
        });

        test("list() and its total exclude hidden requests", async () => {
            const category = await Category.add("category2");
            await RequestModel.create(alice.id, category.id, "Visible", "d");
            await RequestModel.softDelete(request.id, alice.id);

            const result = await RequestModel.list({ user: admin });

            expect(result.requests.map((r) => r.title)).toEqual(["Visible"]);
            expect(result.pagination.total).toBe(1);
        });
    });

    describe("Comment", () => {
        test("get() returns the raw row with author_id", async () => {
            const comment = await Comment.create(request.id, alice.id, "Hi");
            expect(await Comment.get(comment.id)).toMatchObject({
                id: comment.id,
                request_id: request.id,
                author_id: alice.id,
                content: "Hi",
            });
        });

        test("get() returns undefined for unknown or hidden comments", async () => {
            expect(await Comment.get(999)).toBeUndefined();
            const comment = await Comment.create(request.id, alice.id, "Hi");
            await Comment.delete(comment.id, alice.id);
            expect(await Comment.get(comment.id)).toBeUndefined();
        });

        test("delete() records who hid it and when, and keeps the row", async () => {
            const comment = await Comment.create(request.id, alice.id, "Hi");

            const hidden = await Comment.delete(comment.id, admin.id);

            expect(hidden).toMatchObject({
                id: comment.id,
                deleted_by: admin.id,
                deleted_at: expect.any(Date),
            });
            expect(await Comment.findBy(request.id)).toEqual([]);
            expect(
                (
                    await db.query(
                        "SELECT 1 FROM request_comments WHERE id = $1",
                        [comment.id],
                    )
                ).rowCount,
            ).toBe(1);
        });

        test("delete() returns undefined the second time", async () => {
            const comment = await Comment.create(request.id, alice.id, "Hi");
            await Comment.delete(comment.id, alice.id);
            expect(await Comment.delete(comment.id, alice.id)).toBeUndefined();
        });
    });

    describe("Attachment", () => {
        test("create() stores the uploader (null when not given)", async () => {
            const withUser = await addAttachment(request.id, {
                uploadedBy: alice.id,
            });
            const without = await addAttachment(request.id);

            expect(withUser.uploaded_by).toBe(alice.id);
            expect(without.uploaded_by).toBeNull();
        });

        test("delete() hides the attachment from get, list and count", async () => {
            const keep = await addAttachment(request.id, { name: "keep.txt" });
            const gone = await addAttachment(request.id, { name: "gone.txt" });

            const hidden = await Attachment.delete(gone.id, admin.id);

            expect(hidden).toMatchObject({
                id: gone.id,
                deleted_by: admin.id,
                deleted_at: expect.any(Date),
            });
            expect(await Attachment.get(gone.id)).toBeNull();
            expect(
                (await Attachment.listForRequest(request.id)).map((a) => a.id),
            ).toEqual([keep.id]);
            expect(await Attachment.countForRequest(request.id)).toBe(1);
        });

        test("delete() returns undefined for unknown or already hidden attachments", async () => {
            expect(await Attachment.delete(999, admin.id)).toBeUndefined();
            const file = await addAttachment(request.id);
            await Attachment.delete(file.id, admin.id);
            expect(await Attachment.delete(file.id, admin.id)).toBeUndefined();
        });
    });
});
