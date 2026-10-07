module.exports = {
    testEnvironment: "node",
    roots: ["tests"],
    collectCoverageFrom: ["src/**/*.js", "!src/index.js"],
    coverageDirectory: "coverage",
    clearMocks: true,
};
