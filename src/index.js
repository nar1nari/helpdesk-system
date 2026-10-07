const express = require("express");
const config = require("./config");
const app = require("./app");

app.listen(config.port, () => {
    console.log(`app listening on port ${config.port}`);
});
