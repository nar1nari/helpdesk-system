const express = require("express");
const { get, remove } = require("../controllers/attachmentsController");
const authMiddleware = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validate");
const { idParams } = require("../validators/common");

const router = express.Router();

router.get("/:id", authMiddleware, validate({ params: idParams }), get);
router.delete("/:id", authMiddleware, validate({ params: idParams }), remove);

module.exports = router;
