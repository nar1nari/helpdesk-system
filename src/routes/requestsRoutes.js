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
const validate = require("../middlewares/validate");
const { idParams } = require("../validators/common");

const router = express.Router();
const upload = multer({ dest: "uploads/tmp" });

router.get("/", authMiddleware, list);
router.post("/", authMiddleware, create);
router.get("/:id", authMiddleware, validate({ params: idParams }), get);
router.patch(
    "/:id/status",
    authMiddleware,
    validate({ params: idParams }),
    set_status,
);
router.patch(
    "/:id/assign",
    authMiddleware,
    validate({ params: idParams }),
    assign_operator,
);

router.post(
    "/:id/attachments",
    authMiddleware,
    validate({ params: idParams }),
    upload.single("file"),
    create_attachment,
);

router.post(
    "/:id/comments",
    authMiddleware,
    validate({ params: idParams }),
    create_comment,
);
router.get(
    "/:id/comments",
    authMiddleware,
    validate({ params: idParams }),
    get_comments,
);

module.exports = router;
