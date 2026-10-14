const db = require("../db");
const Status = require("./status");

const SORT_FIELDS = Object.freeze({
    id: "id",
    title: "title",
    status: "status",
    created_at: "created_at",
    updated_at: "updated_at",
});

const invalid = (message) => Object.assign(new Error(message), { status: 400 });

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
            throw invalid(`Invalid status: ${status}`);
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
        dateFrom,
        dateTo,
        assigned_operator_id,
        search,
        sortBy = "created_at",
        sortOrder = "DESC",
        page = 1,
        limit = 20,
        currentUserId,
        currentUserRole,
    } = {}) {
        page = Number(page);
        limit = Number(limit);

        if (!Number.isInteger(page) || page < 1) {
            throw invalid("page must be a positive integer");
        }

        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            throw invalid("limit must be an integer between 1 and 100");
        }

        const sortColumn = SORT_FIELDS[sortBy];

        if (!sortColumn) {
            throw invalid("Invalid sortBy field");
        }

        sortOrder = String(sortOrder).toUpperCase();

        if (!["ASC", "DESC"].includes(sortOrder)) {
            throw invalid("sortOrder must be ASC or DESC");
        }

        const conditions = [];
        const values = [];

        const addFilter = (condition, value) => {
            values.push(value);
            conditions.push(condition.replaceAll("?", `$${values.length}`));
        };

        if (currentUserRole === "applicant") {
            addFilter("user_id = ?", currentUserId);
        } else if (currentUserRole === "operator") {
            addFilter(
                "(assigned_operator_id = ? OR assigned_operator_id IS NULL)",
                currentUserId,
            );
        } else if (currentUserRole !== "admin") {
            throw new Error("Invalid user role");
        }

        if (status !== undefined && status !== "") {
            if (!Object.values(Status).includes(status)) {
                throw invalid("Invalid status");
            }

            addFilter("status = ?", status);
        }

        if (category_id !== undefined && category_id !== "") {
            addFilter("category_id = ?", category_id);
        }

        if (assigned_operator_id !== undefined && assigned_operator_id !== "") {
            addFilter("assigned_operator_id = ?", assigned_operator_id);
        }

        if (dateFrom) {
            addFilter("created_at >= ?", dateFrom);
        }

        if (dateTo) {
            addFilter("created_at <= ?", dateTo);
        }

        if (search && search.trim()) {
            addFilter(
                "(title ILIKE ? OR description ILIKE ?)",
                `%${search.trim()}%`,
            );
        }

        const where = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const countResult = await db.query(
            `SELECT COUNT(*)::int AS total
             FROM requests
             ${where}`,
            values,
        );

        const total = countResult.rows[0].total;
        const offset = (page - 1) * limit;

        const result = await db.query(
            `SELECT *
             FROM requests
             ${where}
             ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, id DESC
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
