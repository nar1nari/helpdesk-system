describe("User model", () => {
    let User;

    beforeEach(() => {
        User = require("../../src/models/users");
    });

    test("new user gets applicant role by default", () => {
        const user = new User();
        expect(user.role).toBe("applicant");
    });

    test("save() saves user, find() finds user", () => {
        const user = new User("alice", "1234").save();
        expect(User.find("alice")).toBe(user);
    });

    test("find() returns undefined for unknown user", () => {
        expect(User.find("unknown")).toBeUndefined();
    });
});
