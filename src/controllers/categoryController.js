const Category = require("../models/categories");

exports.all = async (req, res) => {
    res.json({ categories: (await Category.all()).map(({ name }) => name) });
};
