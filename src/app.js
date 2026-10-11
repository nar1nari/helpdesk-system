const express = require("express");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoriesRoutes");
const requestsRoutes = require("./routes/requestsRoutes");

const app = express();

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/categories", categoryRoutes);
app.use("/requests", requestsRoutes);

app.get("/", (req, res) => {
    res.send("Hello World!");
});

module.exports = app;
