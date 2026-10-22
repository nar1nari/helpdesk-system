const { z } = require("zod");
const { id } = require("./common");
const Status = require("../models/status");

exports.create = z.object({
    category_id: id,
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().min(1).max(10000),
});

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");
exports.list = z.object({
    status: z.enum(Object.values(Status)).optional(),
    category_id: id.optional(),
    assigned_operator_id: id.optional(),
    date_from: date.optional(),
    date_to: date.optional(),
    search: z.string().trim().max(100).optional(),
    sort_by: z
        .enum(["id", "title", "status", "created_at", "updated_at"])
        .default("created_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

exports.status = z.object({ status: z.enum(Object.values(Status)) });
