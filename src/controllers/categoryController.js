const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Category = require("../models/categories");
const config = require("../config");

exports.all = async (req, res) => {
    res.json({ categories: (await Category.all()).map(({ name }) => name) });
};
