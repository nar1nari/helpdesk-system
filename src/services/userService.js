const bcrypt = require("bcryptjs");
const User = require("../models/users");
const config = require("../config");
const { unauthorized } = require("../errors");

exports.createUser = async ({ username, password, role }) => {
    const hashed = await bcrypt.hash(password, config.bcryptRounds);
    try {
        return await User.create(username, hashed, role);
    } catch (err) {
        if (err.code === "23505") {
            throw unauthorized("Username already taken");
        }
        throw err;
    }
};
