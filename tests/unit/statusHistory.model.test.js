const StatusHistory = require("../../src/models/statusHistory");
const Category = require("../../src/models/category");
const User = require("../../src/models/users");
const RequestModel = require("../../src/models/requests");

describe("StatusHistory model", () => {
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

    test("status history gets created successfully", async () => {
        const statusHistory = await StatusHistory.create(
            request.id,
            user.id,
            "new",
            "in_progress",
        );
        expect(statusHistory).toMatchObject({
            id: expect.any(Number),
            request_id: request.id,
            changed_by: user.id,
            old_status: "new",
            new_status: "in_progress",
            changed_at: expect.any(Date),
        });
    });

    test("findBy returns all status history for a request", async () => {
        const statusHistory1 = await StatusHistory.create(
            request.id,
            user.id,
            "new",
            "in_progress",
        );
        const statusHistory2 = await StatusHistory.create(
            request.id,
            user.id,
            "in_progress",
            "pending",
        );
        const history = await StatusHistory.getBy(request.id);
        expect(history.map((h) => h.id)).toEqual([
            statusHistory2.id,
            statusHistory1.id,
        ]);
    });

    test("getBy returns changed_by as a nested user", async () => {
        await StatusHistory.create(request.id, user.id, "new", "in_progress");
        const [entry] = await StatusHistory.getBy(request.id);
        expect(entry.changed_by).toEqual({
            id: user.id,
            username: user.username,
        });
    });
});
