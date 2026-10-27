const { z } = require("zod");
const User = require("../models/users");

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

const roleEnum = z.enum(User.Role);
const role = roleEnum.default(User.Role.APPLICANT);

exports.createUser = z.object({ username, password, role });
exports.updateUser = z.object({
    role: roleEnum.optional(),
    isActive: z.boolean().optional(),
});

const categoryName = z.string().trim().min(1).max(50);
exports.createCategory = z.object({ name: categoryName });
