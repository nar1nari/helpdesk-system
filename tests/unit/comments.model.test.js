const Comment = require("../../src/models/comments");
const Category = require("../../src/models/category");
const User = require("../../src/models/users");
const RequestModel = require("../../src/models/requests");

describe("Comments model", () => {
    let request;
    let user;

    beforeEach(async () => {
        user = await User.create("alice", "secret123");
        const category = await Category.add("category1");
        request = await RequestModel.create(
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
            author: { id: user.id, username: user.username },
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

    test("create() returns the comment with a nested author", async () => {
        const comment = await Comment.create(request.id, user.id, "Hi");
        expect(comment).toEqual({
            id: expect.any(Number),
            request_id: request.id,
            content: "Hi",
            created_at: expect.any(Date),
            author: { id: user.id, username: user.username },
        });
    });

    test("findBy() returns comments with a nested author", async () => {
        await Comment.create(request.id, user.id, "Hi");
        const [comment] = await Comment.findBy(request.id);
        expect(comment.author).toEqual({
            id: user.id,
            username: user.username,
        });
        expect(comment).not.toHaveProperty("author_id");
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
        expect(deleted.id).toBe(comment.id);
        expect(deleted.content).toBe("Test comment");
    });
});
