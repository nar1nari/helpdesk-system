const { z } = require("zod");

exports.list = z.object({
    unread: z
        .enum(["true", "false"])
        .transform((v) => v === "true")
        .default(false),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
