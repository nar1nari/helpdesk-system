const js = require("@eslint/js");
const globals = require("globals");
const prettier = require("eslint-config-prettier");

module.exports = [
    { ignores: ["coverage/", "node_modules/", "uploads/"] },
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            sourceType: "commonjs",
            globals: { ...globals.node, ...globals.jest },
        },
        rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
    },
    prettier,
];
