require("dotenv").config({ quiet: true });

module.exports = {
    port: process.env.PORT || 3000,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpires: process.env.JWT_EXPIRES,
    databaseUrl: process.env.DATABASE_URL,
};
