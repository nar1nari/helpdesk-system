const Category = require("../models/category");
const { notFound } = require("../errors");

exports.all = async (req, res) => {
    res.json({ categories: await Category.all() });
};

exports.create = async (req, res) => {
    const category = await Category.add(req.body.name);
    res.status(201).json({ category: category });
};

exports.update = async (req, res) => {
    const category = await Category.update(req.params.id, req.body.name);
    if (!category) throw notFound("Category not found");
    res.json({ category: category });
};

exports.remove = async (req, res) => {
    const category = await Category.remove(req.params.id);
    if (!category) throw notFound("Category not found");
    res.json({ category: category });
};
