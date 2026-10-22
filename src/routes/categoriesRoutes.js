const express = require("express");
const {
    all,
    create,
    update,
    remove,
} = require("../controllers/categoriesController");
const authMiddleware = require("../middlewares/authMiddleware");
const requireRole = require("../middlewares/requireRole");
const validate = require("../middlewares/validate");
const { createCategory } = require("../validators/admin");
const { idParams } = require("../validators/common");

const router = express.Router();
router.use(authMiddleware);

router.get("/", all);
router.post(
    "/",
    requireRole("admin"),
    validate({ body: createCategory }),
    create,
);
router.patch(
    "/:id",
    requireRole("admin"),
    validate({ params: idParams, body: createCategory }),
    update,
);
router.delete(
    "/:id",
    requireRole("admin"),
    validate({ params: idParams, body: createCategory }),
    remove,
);

module.exports = router;
