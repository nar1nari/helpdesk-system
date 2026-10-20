const db = require("../db");
const Status = require("./status");
const { badRequest } = require("../errors");

const SORT_FIELDS = Object.freeze({
    id: "r.id",
    title: "r.title",
    status: "r.status",
    created_at: "r.created_at",
    updated_at: "r.updated_at",
});

const Request = {
    Status,

    async create(user_id, category_id, title, description) {
        const { rows } = await db.query(
            `INSERT INTO requests (user_id, category_id, title, description)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [user_id, category_id, title, description],
        );
        return rows[0];
    },

    async get(request_id) {
        const { rows } = await db.query(
            "SELECT * FROM requests WHERE id = $1",
            [request_id],
        );
        return rows[0];
    },

    async set_status(request_id, status) {
        if (!Object.values(Request.Status).includes(status)) {
            throw badRequest("Invalid status", status);
        }
        const { rows } = await db.query(
            "UPDATE requests SET status = $1 WHERE id = $2 RETURNING status",
            [status, request_id],
        );
        return rows[0];
    },

    async assign_operator(request_id, operator_id) {
        const { rows } = await db.query(
            "UPDATE requests SET assigned_operator_id = $1 WHERE id = $2 RETURNING assigned_operator_id",
            [operator_id, request_id],
        );
        return rows[0];
    },

    async list({
        status,
        category_id,
        date_from,
        date_to,
        assigned_operator_id,
        search,
        sort_by = "created_at",
        sort_order = "desc",
        page = 1,
        limit = 20,
        user,
    } = {}) {
        const col = SORT_FIELDS[sort_by] ?? SORT_FIELDS.created_at;
        const dir = sort_order === "asc" ? "ASC" : "DESC";

        const conditions = [];
        const values = [];

        const addFilter = (condition, value) => {
            values.push(value);
            conditions.push(condition.replaceAll("?", `$${values.length}`));
        };

        if (
            status !== undefined &&
            !Object.values(Request.Status).includes(status)
        ) {
            throw badRequest("Invalid status", status);
        }

        if (user.role === "applicant") {
            addFilter("r.user_id = ?", user.id);
        } else if (user.role === "operator") {
            addFilter(
                "(r.assigned_operator_id = ? OR r.assigned_operator_id IS NULL)",
                user.id,
            );
        } else if (user.role !== "admin") {
            throw new Error("Invalid user role");
        }

        if (status !== undefined) {
            addFilter("r.status = ?", status);
        }

        if (category_id !== undefined) {
            addFilter("r.category_id = ?", category_id);
        }

        if (assigned_operator_id !== undefined) {
            addFilter("r.assigned_operator_id = ?", assigned_operator_id);
        }

        if (date_from) {
            addFilter("r.created_at >= ?::date", date_from);
        }

        if (date_to) {
            addFilter("r.created_at < (?::date + 1)", date_to);
        }

        if (search) {
            const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
            const pattern = `%${escapedSearch}%`;

            values.push(pattern);
            const searchParam = `$${values.length}`;

            conditions.push(
                `(r.title ILIKE ${searchParam} ESCAPE '\\' OR ` +
                    `r.description ILIKE ${searchParam} ESCAPE '\\')`,
            );
        }

        const where = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const countResult = await db.query(
            `SELECT COUNT(*)::int AS total
         FROM requests r
         ${where}`,
            values,
        );

        const total = countResult.rows[0].total;
        const offset = (page - 1) * limit;

        const result = await db.query(
            `SELECT r.*, c.name AS category_name
         FROM requests r
         LEFT JOIN categories c ON c.id = r.category_id
         ${where}
         ORDER BY ${col} ${dir} NULLS LAST, r.id ${dir}
         LIMIT $${values.length + 1}
         OFFSET $${values.length + 2}`,
            [...values, limit, offset],
        );

        return {
            requests: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    },
};

module.exports = Request;
