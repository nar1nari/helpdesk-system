const express = require("express");
const { get } = require("../controllers/attachmentsController");
const authMiddleware = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validate");
const { idParams } = require("../validators/common");

const router = express.Router();

router.get("/:id", authMiddleware, validate({ params: idParams }), get);

module.exports = router;
