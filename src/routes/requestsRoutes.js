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
const {
    create: create_comment,
    get: get_comments,
} = require("../controllers/commentsController");
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

router.post("/:id/comments", authMiddleware, create_comment);
router.get("/:id/comments", authMiddleware, get_comments);

module.exports = router;
