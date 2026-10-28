const bcrypt = require("bcryptjs");
const db = require("../src/db");

const CATEGORIES = [
    "Hardware",
    "Software",
    "Network",
    "Accounts and access",
    "Other",
];

(async () => {
    const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password || password.length < 12) {
        throw new Error("Set SEED_ADMIN_PASSWORD (at least 12 characters)");
    }
    await db.query(
        `INSERT INTO users (username, password, role) VALUES ($1, $2, 'admin')
         ON CONFLICT (username) DO NOTHING`,
        [username, await bcrypt.hash(password, 12)],
    );
    for (const name of CATEGORIES) {
        await db.query(
            "INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING",
            [name],
        );
    }
    await db.pool.end();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
