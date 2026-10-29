const express = require("express");
const helmet = require("helmet");
const { notFound } = require("./errors");
const errorHandler = require("./middlewares/errorHandler");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoriesRoutes");
const requestsRoutes = require("./routes/requestsRoutes");
const attachmentsRoutes = require("./routes/attachmentsRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationsRoutes = require("./routes/notificationsRoutes");

const app = express();

app.use(helmet());
app.use(express.json({ limit: "100kb" }));

app.use("/auth", authRoutes);
app.use("/categories", categoryRoutes);
app.use("/requests", requestsRoutes);
app.use("/attachments", attachmentsRoutes);
app.use("/admin", adminRoutes);
app.use("/notifications", notificationsRoutes);
app.use((req, res, next) => next(notFound("Route not found")));
app.use(errorHandler);

module.exports = app;
