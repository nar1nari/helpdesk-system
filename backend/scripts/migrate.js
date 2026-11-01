const fs = require("node:fs");
const path = require("node:path");
const db = require("../src/db");

(async () => {
    const sql = fs.readFileSync(
        path.join(__dirname, "../src/db/schema.sql"),
        "utf8",
    );
    await db.query(sql);
    console.log("Database schema is up to date");
    await db.pool.end();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
