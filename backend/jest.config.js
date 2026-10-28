module.exports = {
    testEnvironment: "node",
    roots: ["tests"],
    collectCoverageFrom: ["src/**/*.js", "!src/index.js"],
    setupFiles: ["<rootDir>/tests/helpers/env.js"],
    setupFilesAfterEnv: ["<rootDir>/tests/helpers/setupDb.js"],
    coverageDirectory: "coverage",
    maxWorkers: 1,
    clearMocks: true,
};
