module.exports = function createApp() {
    jest.resetModules();
    return require("../../src/app");
};
