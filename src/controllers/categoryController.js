const Category = require("../models/categories");

exports.all = async (req, res) => {
    res.json({ categories: await Category.all() });
};

exports.create = async (req, res) => {
    const category = await Category.add(req.body.name);
    res.status(201).json({ category: category });
};

exports.update = async (req, res) => {
    const category = await Category.update(req.params.id, req.body.name);
    res.json({ category: category });
};

exports.remove = async (req, res) => {
    const category = await Category.remove(req.params.id);
    res.json({ category: category });
};
