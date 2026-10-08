const db = require("../db");

const Role = Object.freeze({
    APPLICANT: "applicant",
    OPERATOR: "operator",
    ADMIN: "admin",
});

const User = {
    Role,

    async create(username, passwordHash, role = Role.APPLICANT) {
        const { rows } = await db.query(
            `INSERT INTO users (username, password, role)
             VALUES ($1, $2, $3)
             RETURNING id, username, role, created_at`,
            [username, passwordHash, role],
        );
        return rows[0];
    },

    async find(username) {
        const { rows } = await db.query(
            "SELECT * FROM users WHERE username = $1",
            [username],
        );
        return rows[0];
    },
};

module.exports = User;
