const db = require("../../src/db");

const dbName = new URL(process.env.DATABASE_URL).pathname.slice(1);
if (!dbName.endsWith("_test")) {
    throw new Error(
        `Refusing to truncate "${dbName}": test DB name must end in _test`,
    );
}

beforeEach(async () => {
    await db.query("TRUNCATE users, categories RESTART IDENTITY CASCADE;");
});

afterAll(async () => {
    await db.pool.end();
});
