const express = require("express");
const { all } = require("../controllers/categoryController");

const router = express.Router();

router.get("/", all);

module.exports = router;
