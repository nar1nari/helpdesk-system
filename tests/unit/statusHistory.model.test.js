const StatusHistory = require("../../src/models/statusHistory");
const Category = require("../../src/models/categories");
const User = require("../../src/models/users");
const Request = require("../../src/models/requests");

describe("StatusHistory model", () => {
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

    test("errors when creating with invalid status", async () => {
        await expect(
            StatusHistory.create(request.id, user.id, "new", "invalid_status"),
        ).rejects.toThrow("Invalid status");
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
        expect(await StatusHistory.getBy(request.id)).toEqual([
            statusHistory2,
            statusHistory1,
        ]);
    });
});
