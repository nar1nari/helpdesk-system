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

const SELECT_REQUEST = `
    SELECT r.*,
           json_build_object('id', u.id, 'username', u.username) AS "user",
           json_build_object('id', c.id, 'name', c.name) AS category,
           CASE WHEN o.id IS NULL THEN NULL
                ELSE json_build_object('id', o.id, 'username', o.username)
           END AS assigned_operator
    FROM requests r
    JOIN users u ON u.id = r.user_id
    JOIN categories c ON c.id = r.category_id
    LEFT JOIN users o ON o.id = r.assigned_operator_id`;

const RequestModel = {
    Status,

    async create(user_id, category_id, title, description) {
        const { rows } = await db.query(
            `INSERT INTO requests (user_id, category_id, title, description)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [user_id, category_id, title, description],
        );
        return RequestModel.get(rows[0].id);
    },

    async get(request_id) {
        const { rows } = await db.query(
            `${SELECT_REQUEST} WHERE r.id = $1 AND r.deleted_at IS NULL`,
            [request_id],
        );
        return rows[0];
    },

    async softDelete(request_id, deleted_by) {
        const { rows } = await db.query(
            `UPDATE requests
             SET deleted_at = now(), deleted_by = $2
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING id, deleted_at, deleted_by`,
            [request_id, deleted_by],
        );
        return rows[0];
    },

    async setStatus(request_id, status) {
        if (!Object.values(RequestModel.Status).includes(status)) {
            throw badRequest("Invalid status", status);
        }
        const { rows } = await db.query(
            "UPDATE requests SET status = $1 WHERE id = $2 RETURNING id",
            [status, request_id],
        );
        return rows[0] && RequestModel.get(rows[0].id);
    },

    async assignOperator(request_id, operator_id) {
        const { rows } = await db.query(
            "UPDATE requests SET assigned_operator_id = $1 WHERE id = $2 RETURNING id",
            [operator_id, request_id],
        );
        return rows[0] && RequestModel.get(rows[0].id);
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
    }) {
        const col = SORT_FIELDS[sort_by] ?? SORT_FIELDS.created_at;
        const dir = sort_order === "asc" ? "ASC" : "DESC";

        const conditions = ["r.deleted_at IS NULL"];
        const values = [];

        const addFilter = (condition, value) => {
            values.push(value);
            conditions.push(condition.replaceAll("?", `$${values.length}`));
        };

        if (
            status !== undefined &&
            !Object.values(RequestModel.Status).includes(status)
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
            `${SELECT_REQUEST}
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

module.exports = RequestModel;
