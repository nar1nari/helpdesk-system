const db = require("../db");

const Category = {
    async add(name) {
        const { rows } = await db.query(
            `INSERT INTO categories (name)
             VALUES ($1)
             RETURNING id, name`,
            [name],
        );
        return rows[0];
    },

    async remove(id) {
        const { rows } = await db.query(
            `DELETE FROM categories
             WHERE id = ($1)
             RETURNING id, name`,
            [id],
        );
        return rows[0];
    },

    async update(id, name) {
        const { rows } = await db.query(
            `UPDATE categories
             SET name = $1
             WHERE id = $2`,
            [name, id],
        );
        return rows[0];
    },

    async find(name) {
        const { rows } = await db.query(
            "SELECT * FROM categories WHERE name = $1",
            [name],
        );
        return rows[0];
    },

    async findById(id) {
        const { rows } = await db.query(
            "SELECT * FROM categories WHERE id = $1",
            [id],
        );
        return rows[0];
    },

    async all() {
        const { rows } = await db.query("SELECT * FROM categories");
        return rows;
    },
};

module.exports = Category;
