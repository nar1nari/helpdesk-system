const request = require("supertest");
const db = require("../../src/db");
const User = require("../../src/models/users");

const password = "secret123";

function createAuthHelpers(app) {
    async function signUp(username, role = "applicant") {
        await request(app).post("/auth/register").send({ username, password });

        if (role !== "applicant") {
            await db.query("UPDATE users SET role = $1 WHERE username = $2", [
                role,
                username,
            ]);
        }

        const login = await request(app)
            .post("/auth/login")
            .send({ username, password });

        return {
            token: login.body.token,
            user: await User.find(username),
        };
    }

    const auth = (token) => ({
        Authorization: `Bearer ${token}`,
    });

    return { signUp, auth };
}

module.exports = createAuthHelpers;
