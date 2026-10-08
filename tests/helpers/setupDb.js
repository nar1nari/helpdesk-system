const db = require("../../src/db");

beforeEach(async () => {
    await db.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
});

afterAll(async () => {
    await db.pool.end();
});
