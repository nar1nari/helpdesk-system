require("dotenv").config({ quiet: true });
const { z } = require("zod");

const schema = z.object({
    NODE_ENV: z.enum(["dev", "test", "prod"]).default("dev"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32, "must be at least 32 characters"),
    JWT_EXPIRES: z.string().default("1h"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    for (const i of parsed.error.issues)
        console.error(`Invalid env ${i.path.join(".")}: ${i.message}`);
    process.exit(1);
}
const env = parsed.data;

module.exports = {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    jwtExpires: env.JWT_EXPIRES,
    bcryptRounds: env.NODE_ENV === "test" ? 4 : 12,
};
