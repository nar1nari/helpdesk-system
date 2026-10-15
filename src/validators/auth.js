const { z } = require("zod");

const username = z
    .string()
    .trim()
    .regex(
        /^[A-Za-z0-9_.-]{3,32}$/,
        "3 to 32 characters: letters, digits, _ . -",
    );
const password = z
    .string()
    .min(8, "at least 8 characters")
    .refine((p) => Buffer.byteLength(p) <= 72, "at most 72 bytes");

exports.register = z.object({ username, password });
exports.login = z.object({
    username: z.string().min(1),
    password: z.string().min(1).max(200),
});
