const User = require("../../src/models/users");

describe("User model", () => {
    test("new user gets applicant role by default", async () => {
        const user = await User.create("alice", "secret123");
        expect(user.role).toBe("applicant");
    });

    test("new user can be created with a specific role", async () => {
        const user = await User.create(
            "admin_user",
            "secret123",
            User.Role.ADMIN,
        );
        expect(user.role).toBe("admin");
    });

    test("find() finds user", async () => {
        await User.create("alice", "secret123");
        expect(await User.find("alice")).toMatchObject({
            username: "alice",
            role: "applicant",
        });
    });

    test("find() returns undefined for unknown user", async () => {
        expect(await User.find("unknown")).toBeUndefined();
    });

    test("findById() finds user by id", async () => {
        const created = await User.create("alice", "secret123");
        const user = await User.findById(created.id);
        expect(user).toMatchObject({
            id: created.id,
            username: "alice",
            role: "applicant",
            is_active: true,
        });
    });

    test("findById() returns undefined for unknown id", async () => {
        expect(await User.findById(99999)).toBeUndefined();
    });

    test("changeRole() updates user role", async () => {
        const created = await User.create("alice", "secret123");
        const updated = await User.changeRole(created.id, User.Role.OPERATOR);
        expect(updated.role).toBe("operator");

        const fetched = await User.findById(created.id);
        expect(fetched.role).toBe("operator");
    });

    test("changeActive() updates user active status", async () => {
        const created = await User.create("alice", "secret123");
        expect(created.is_active).toBe(true);

        const updated = await User.changeActive(created.id, false);
        expect(updated.is_active).toBe(false);

        const fetched = await User.findById(created.id);
        expect(fetched.is_active).toBe(false);
    });

    test("all() returns users", async () => {
        await User.create("alice", "secret123");
        await User.create("bob", "secret123");

        const user = await User.all();
        expect(user).toBeDefined();
        expect(user.username).toBe("alice");
    });

    test("delete() removes the user", async () => {
        await User.create("alice", "secret123");
        const deleted = await User.delete("alice");

        expect(deleted).toMatchObject({
            username: "alice",
            role: "applicant",
        });
        expect(await User.find("alice")).toBeUndefined();
    });

    test("fails to create user with an invalid username (too short)", async () => {
        await expect(User.create("al", "secret123")).rejects.toThrow();
    });

    test("fails to create user with an invalid username (invalid characters)", async () => {
        await expect(User.create("alice!", "secret123")).rejects.toThrow();
    });

    test("fails to create user with an invalid role", async () => {
        await expect(
            User.create("alice", "secret123", "superadmin"),
        ).rejects.toThrow();
    });

    test("fails to change role to an invalid role", async () => {
        const created = await User.create("alice", "secret123");
        await expect(
            User.changeRole(created.id, "superadmin"),
        ).rejects.toThrow();
    });
});
