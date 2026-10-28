const express = require("express");
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
    listForRequest: listAttachments,
} = require("../controllers/attachmentsController");
const upload = require("../middlewares/upload");
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
    list: listSchema,
    status: statusSchema,
    assignOperator: assignOperatorSchema,
} = require("../validators/requests");
const { commentBody } = require("../validators/comments");
const { canChangeStatus } = require("../policies/requestPolicy");

const router = express.Router();
router.use(authMiddleware);

router.get("/", validate({ query: listSchema }), list);
router.post("/", validate({ body: createSchema }), create);
router.get("/:id", validate({ params: idParams }), loadRequest(), get);
router.patch(
    "/:id/status",
    validate({ params: idParams, body: statusSchema }),
    loadRequest(canChangeStatus),
    setStatus,
);
router.get(
    "/:id/status",
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
    upload,
    createAttachment,
);
router.get(
    "/:id/attachments",
    validate({ params: idParams }),
    loadRequest(),
    listAttachments,
);

router.post(
    "/:id/comments",
    validate({ params: idParams, body: commentBody }),
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
