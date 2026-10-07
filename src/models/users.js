const users = [];

const Role = Object.freeze({
    APPLICANT: "applicant",
    OPERATOR: "operator",
    ADMIN: "admin",
});

class User {
    constructor(
        username,
        password,
        role = Role.APPLICANT,
        created_at = new Date(),
    ) {
        this.username = username;
        this.password = password;
        this.role = role;
        this.created_at = created_at;
    }

    save() {
        users.push(this);
        return this;
    }

    static find(username) {
        return users.find((u) => u.username === username);
    }
}

module.exports = User;
