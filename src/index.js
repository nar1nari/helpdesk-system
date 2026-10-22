const config = require("./config");
const app = require("./app");
const fs = require("fs");

fs.mkdirSync(config.uploadDir, { recursive: true });

app.listen(config.port, () => {
    console.log(`app listening on port ${config.port}`);
});
