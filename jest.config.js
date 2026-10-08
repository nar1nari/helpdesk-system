module.exports = {
    testEnvironment: "node",
    roots: ["tests"],
    collectCoverageFrom: ["src/**/*.js", "!src/index.js"],
    setupFilesAfterEnv: ["<rootDir>/tests/helpers/setupDb.js"],
    coverageDirectory: "coverage",
    maxWorkers: 1,
    clearMocks: true,
};
