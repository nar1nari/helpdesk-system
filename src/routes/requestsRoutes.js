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
const loadRequest = require("../middlewares/loadRequest");
const validate = require("../middlewares/validate");
const { idParams } = require("../validators/common");
const {
    create: createSchema,
    list: listSchena,
} = require("../validators/requests");
const { canChangeStatus } = require("../policies/requestPolicy");

const router = express.Router();
router.use(authMiddleware);

const upload = multer({ dest: "uploads/tmp" });

router.get("/", validate({ query: listSchena }), list);
router.post("/", validate({ body: createSchema }), create);
router.get("/:id", validate({ params: idParams }), loadRequest(), get);
router.patch(
    "/:id/status",
    validate({ params: idParams }),
    loadRequest(canChangeStatus),
    set_status,
);
router.patch("/:id/assign", validate({ params: idParams }), assign_operator);

router.post(
    "/:id/attachments",
    validate({ params: idParams }),
    loadRequest(),
    upload.single("file"),
    create_attachment,
);

router.post(
    "/:id/comments",
    validate({ params: idParams }),
    loadRequest(),
    create_comment,
);
router.get(
    "/:id/comments",
    validate({ params: idParams }),
    loadRequest(),
    get_comments,
);

module.exports = router;
