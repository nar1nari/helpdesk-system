const express = require("express");
const { get } = require("../controllers/attachmentsController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/:id", authMiddleware, get);

module.exports = router;
