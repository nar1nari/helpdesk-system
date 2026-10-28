const bcrypt = require("bcryptjs");
const User = require("../../src/models/users");
const { createUser } = require("../../src/services/userService");

describe("userService.createUser", () => {
    test("stores a bcrypt hash instead of the password", async () => {
        const user = await createUser({
            username: "alice",
            password: "secret123",
        });

        const stored = await User.find("alice");
        expect(stored.password).not.toBe("secret123");
        expect(await bcrypt.compare("secret123", stored.password)).toBe(true);
        expect(user).toEqual({
            id: expect.any(Number),
            username: "alice",
            role: "applicant",
            is_active: true,
        });
    });

    test("uses the given role", async () => {
        const user = await createUser({
            username: "alice",
            password: "secret123",
            role: "operator",
        });
        expect(user.role).toBe("operator");
    });

    test("401 'Username already taken' for a duplicate username", async () => {
        await createUser({ username: "alice", password: "secret123" });

        await expect(
            createUser({ username: "alice", password: "secret123" }),
        ).rejects.toMatchObject({
            status: 401,
            message: "Username already taken",
        });
    });

    test("duplicate check ignores letter case", async () => {
        await createUser({ username: "alice", password: "secret123" });

        await expect(
            createUser({ username: "ALICE", password: "secret123" }),
        ).rejects.toMatchObject({ status: 401 });
    });

    test("rethrows other database errors", async () => {
        const error = new Error("db down");
        const spy = jest.spyOn(User, "create").mockRejectedValueOnce(error);

        await expect(
            createUser({ username: "alice", password: "secret123" }),
        ).rejects.toBe(error);

        spy.mockRestore();
    });
});
