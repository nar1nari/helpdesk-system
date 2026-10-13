const Comment = require("../../src/models/comments");
const Category = require("../../src/models/categories");
const User = require("../../src/models/users");
const Request = require("../../src/models/requests");

describe("Comments model", () => {
    let request;
    let user;

    beforeEach(async () => {
        user = await User.create("alice", "secret123");
        const category = await Category.add("category1");
        request = await Request.create(
            user.id,
            category.id,
            "Test request",
            "Test description",
        );
    });

    test("comment gets created successfully", async () => {
        const comment = await Comment.create(
            request.id,
            user.id,
            "Test comment",
        );
        expect(comment).toMatchObject({
            id: expect.any(Number),
            request_id: request.id,
            author_id: user.id,
            content: "Test comment",
            created_at: expect.any(Date),
        });
    });

    test("findBy() finds comments", async () => {
        const comment1 = await Comment.create(
            request.id,
            user.id,
            "Test comment",
        );
        const comment2 = await Comment.create(
            request.id,
            user.id,
            "Test comment",
        );
        expect(await Comment.findBy(request.id)).toEqual([comment1, comment2]);
    });

    test("findBy() returns empty array if no comments", async () => {
        expect(await Comment.findBy(request.id)).toEqual([]);
    });

    test("delete() removes comment", async () => {
        const comment = await Comment.create(
            request.id,
            user.id,
            "Test comment",
        );
        const deleted = await Comment.delete(comment.id);

        expect(await Comment.findBy(request.id)).toEqual([]);
        expect(deleted).toEqual(comment);
    });
});
