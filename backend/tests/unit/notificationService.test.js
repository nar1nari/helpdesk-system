const Notification = require("../../src/models/notifications");
const Category = require("../../src/models/category");
const User = require("../../src/models/users");
const RequestModel = require("../../src/models/requests");
const service = require("../../src/services/notificationService");

describe("notificationService", () => {
    let alice;
    let olga;
    let admin;
    let request;

    beforeEach(async () => {
        alice = await User.create("alice", "secret123");
        olga = await User.create("olga", "secret123", "operator");
        admin = await User.create("admin", "secret123", "admin");
        const category = await Category.add("category1");
        request = await RequestModel.create(
            alice.id,
            category.id,
            "Test request",
            "Test description",
        );
    });

    describe("recipientsFor()", () => {
        test("only the applicant when no operator is assigned", async () => {
            expect(await service.recipientsFor(request, admin.id)).toEqual([
                alice.id,
            ]);
        });

        test("applicant and operator, minus the actor", async () => {
            request = await RequestModel.assignOperator(request.id, olga.id);
            expect(
                (await service.recipientsFor(request, admin.id)).sort(),
            ).toEqual([alice.id, olga.id].sort());
            expect(await service.recipientsFor(request, alice.id)).toEqual([
                olga.id,
            ]);
            expect(await service.recipientsFor(request, olga.id)).toEqual([
                alice.id,
            ]);
        });

        test("nobody when the actor is the only party", async () => {
            expect(await service.recipientsFor(request, alice.id)).toEqual([]);
        });

        test("a user who is both applicant and operator is listed once", async () => {
            request = await RequestModel.assignOperator(request.id, alice.id);
            expect(await service.recipientsFor(request, admin.id)).toEqual([
                alice.id,
            ]);
        });

        test("skips deactivated users", async () => {
            await User.changeActive(alice.id, false);
            expect(await service.recipientsFor(request, admin.id)).toEqual([]);
        });
    });

    test("notify() returns the number of notifications created", async () => {
        expect(await service.commentAdded(request, { id: admin.id })).toBe(1);
    });

    test("notify() swallows and logs errors", async () => {
        const create = jest
            .spyOn(Notification, "createMany")
            .mockRejectedValue(new Error("boom"));
        const log = jest.spyOn(console, "error").mockImplementation(() => {});

        await expect(
            service.fileAdded(request, { id: admin.id }, "a.txt"),
        ).resolves.toBe(0);
        expect(log).toHaveBeenCalledWith(
            "Failed to create notifications",
            expect.any(Error),
        );

        create.mockRestore();
        log.mockRestore();
    });
});
