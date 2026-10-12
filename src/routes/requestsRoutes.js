const express = require("express");
const multer = require("multer");
const {
    create,
    get,
    set_status,
    list,
    assign_operator,
} = require("../controllers/requestsController");
const {
    create: create_attachment,
} = require("../controllers/attachmentsController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();
const upload = multer({ dest: "uploads/tmp" });

router.get("/", authMiddleware, list);
router.post("/", authMiddleware, create);
router.get("/:id", authMiddleware, get);
router.patch("/:id/status", authMiddleware, set_status);
router.patch("/:id/assign", authMiddleware, assign_operator);

router.post(
    "/:id/attachments",
    authMiddleware,
    upload.single("file"),
    create_attachment,
);

module.exports = router;
