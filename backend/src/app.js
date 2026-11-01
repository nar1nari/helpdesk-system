const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const helmet = require("helmet");
const config = require("./config");
const db = require("./db");
const { notFound } = require("./errors");
const errorHandler = require("./middlewares/errorHandler");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoriesRoutes");
const requestsRoutes = require("./routes/requestsRoutes");
const attachmentsRoutes = require("./routes/attachmentsRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationsRoutes = require("./routes/notificationsRoutes");

const app = express();

if (config.trustProxy !== undefined) app.set("trust proxy", config.trustProxy);

app.use(helmet());
app.use(express.json({ limit: "100kb" }));

const api = express.Router();
api.get("/health", async (req, res) => {
    await db.query("SELECT 1");
    res.json({ status: "ok" });
});
api.use("/auth", authRoutes);
api.use("/categories", categoryRoutes);
api.use("/requests", requestsRoutes);
api.use("/attachments", attachmentsRoutes);
api.use("/admin", adminRoutes);
api.use("/notifications", notificationsRoutes);
app.use("/api", api);
app.use(api);

if (config.frontendDist) {
    const dist = path.resolve(config.frontendDist);
    if (!fs.existsSync(path.join(dist, "index.html"))) {
        throw new Error(
            `FRONTEND_DIST=${dist} does not contain index.html (run "npm run build" first)`,
        );
    }
    app.use(
        "/assets",
        express.static(path.join(dist, "assets"), {
            immutable: true,
            maxAge: "1y",
            fallthrough: false,
        }),
    );
    app.get("/", (req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((req, res, next) => next(notFound("Route not found")));
app.use(errorHandler);

module.exports = app;
