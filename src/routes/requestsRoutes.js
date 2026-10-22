const express = require("express");
const multer = require("multer");
const {
    create,
    get,
    setStatus,
    list,
    assignOperator,
    getStatusHistory,
} = require("../controllers/requestsController");
const {
    create: createAttachment,
} = require("../controllers/attachmentsController");
const {
    create: createComment,
    get: getComments,
} = require("../controllers/commentsController");
const authMiddleware = require("../middlewares/authMiddleware");
const loadRequest = require("../middlewares/loadRequest");
const validate = require("../middlewares/validate");
const { idParams } = require("../validators/common");
const {
    create: createSchema,
    list: listSchena,
    status: statusSchema,
    assignOperator: assignOperatorSchema,
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
    validate({ params: idParams, body: statusSchema }),
    loadRequest(canChangeStatus),
    setStatus,
);
router.get(
    "/requests/:id/status",
    validate({ params: idParams }),
    loadRequest(),
    getStatusHistory,
);
router.patch(
    "/:id/assign",
    validate({ params: idParams, body: assignOperatorSchema }),
    loadRequest(),
    assignOperator,
);

router.post(
    "/:id/attachments",
    validate({ params: idParams }),
    loadRequest(),
    upload.single("file"),
    createAttachment,
);

router.post(
    "/:id/comments",
    validate({ params: idParams }),
    loadRequest(),
    createComment,
);
router.get(
    "/:id/comments",
    validate({ params: idParams }),
    loadRequest(),
    getComments,
);

module.exports = router;
