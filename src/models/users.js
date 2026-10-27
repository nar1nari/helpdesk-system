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
             RETURNING id, username, role, is_active`,
            [username, passwordHash, role],
        );
        return rows[0];
    },

    async changeRole(id, role) {
        const { rows } = await db.query(
            `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role, is_active, created_at`,
            [role, id],
        );
        return rows[0];
    },

    async changeActive(id, isActive) {
        const { rows } = await db.query(
            `UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, username, role, is_active, created_at`,
            [isActive, id],
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

    async findById(id) {
        const { rows } = await db.query(
            "SELECT id, username, role, is_active, created_at FROM users WHERE id = $1",
            [id],
        );
        return rows[0];
    },

    async all() {
        const { rows } = await db.query(
            "SELECT id, username, role, is_active, created_at FROM users ORDER BY id",
        );
        return rows;
    },

    async delete(username) {
        const { rows } = await db.query(
            `DELETE FROM users WHERE username = $1
             RETURNING id, username, role, created_at`,
            [username],
        );
        return rows[0];
    },
};

module.exports = User;
