const User = require("../../src/models/users");

const creds = { username: "alice", password: "secret123" };

describe("User model", () => {
    test("new user gets applicant role by default", async () => {
        const user = await User.create(creds.username, creds.password);
        expect(user.role).toBe("applicant");
    });

    test("find() finds user", async () => {
        const user = await User.create(creds.username, creds.password);
        expect(await User.find(creds.username)).toMatchObject(user);
    });

    test("find() returns undefined for unknown user", async () => {
        expect(await User.find("unknown")).toBeUndefined();
    });
});
