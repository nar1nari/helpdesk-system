const Notification = require("../../src/models/notifications");
const Category = require("../../src/models/category");
const User = require("../../src/models/users");
const RequestModel = require("../../src/models/requests");

describe("Notifications model", () => {
    let alice;
    let olga;
    let request;

    beforeEach(async () => {
        alice = await User.create("alice", "secret123");
        olga = await User.create("olga", "secret123", "operator");
        const category = await Category.add("category1");
        request = await RequestModel.create(
            alice.id,
            category.id,
            "Test request",
            "Test description",
        );
    });

    const make = (userIds, type = "comment_added", meta) =>
        Notification.createMany(userIds, {
            requestId: request.id,
            actorId: olga.id,
            type,
            meta,
        });

    test("createMany() creates one notification per recipient", async () => {
        expect(await make([alice.id, olga.id])).toBe(2);
        expect(
            (await Notification.listFor(alice.id)).notifications,
        ).toHaveLength(1);
        expect(
            (await Notification.listFor(olga.id)).notifications,
        ).toHaveLength(1);
    });

    test("createMany() with no recipients does nothing", async () => {
        expect(await make([])).toBe(0);
    });

    test("createMany() rejects an unknown type", async () => {
        await expect(make([alice.id], "nope")).rejects.toThrow(
            "Unknown notification type",
        );
    });

    test("listFor() returns the public shape", async () => {
        await make([alice.id], "status_changed", {
            old_status: "new",
            new_status: "in_progress",
        });

        const { notifications, pagination } = await Notification.listFor(
            alice.id,
        );

        expect(notifications).toEqual([
            {
                id: expect.any(Number),
                request_id: request.id,
                type: "status_changed",
                meta: { old_status: "new", new_status: "in_progress" },
                is_read: false,
                created_at: expect.any(Date),
                request_title: "Test request",
                actor: { id: olga.id, username: "olga" },
            },
        ]);
        expect(pagination).toEqual({
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
        });
    });

    test("actor is null once the actor account is gone", async () => {
        await make([alice.id]);
        await User.delete("olga");
        const { notifications } = await Notification.listFor(alice.id);
        expect(notifications[0].actor).toBeNull();
    });

    test("unreadCount(), markRead() and markAllRead()", async () => {
        await make([alice.id]);
        await make([alice.id]);
        const { notifications } = await Notification.listFor(alice.id);

        expect(await Notification.unreadCount(alice.id)).toBe(2);
        expect(
            (await Notification.markRead(notifications[0].id, alice.id))
                .is_read,
        ).toBe(true);
        expect(await Notification.unreadCount(alice.id)).toBe(1);
        expect(await Notification.markAllRead(alice.id)).toBe(1);
        expect(await Notification.unreadCount(alice.id)).toBe(0);
        expect(await Notification.markAllRead(alice.id)).toBe(0);
    });

    test("markRead() does not touch another user's notification", async () => {
        await make([alice.id]);
        const { notifications } = await Notification.listFor(alice.id);

        expect(
            await Notification.markRead(notifications[0].id, olga.id),
        ).toBeUndefined();
        expect(await Notification.unreadCount(alice.id)).toBe(1);
    });

    test("notifications of a hidden request are excluded", async () => {
        await make([alice.id]);
        await RequestModel.softDelete(request.id, alice.id);

        expect((await Notification.listFor(alice.id)).notifications).toEqual(
            [],
        );
        expect(await Notification.unreadCount(alice.id)).toBe(0);
    });
});
