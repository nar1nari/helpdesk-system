const express = require("express");
const {
    createUser,
    listUsers,
    updateUser,
} = require("../controllers/adminController");
const authMiddleware = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validate");
const { idParams } = require("../validators/common");
const {
    createUser: createUserBody,
    updateUser: updateUserBody,
} = require("../validators/admin");
const requireRole = require("../middlewares/requireRole");

const router = express.Router();

router.use(authMiddleware, requireRole("admin"));

router.post("/users", validate({ body: createUserBody }), createUser);

router.get("/users", listUsers);

router.patch(
    "/users/:id",
    validate({ params: idParams, body: updateUserBody }),
    updateUser,
);

module.exports = router;
