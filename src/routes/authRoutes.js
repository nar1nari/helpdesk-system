const express = require("express");
const { register, login, me } = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const { authLimiter } = require("../middlewares/rateLimit");
const validate = require("../middlewares/validate");
const schemas = require("../validators/auth");

const router = express.Router();

router.post(
    "/register",
    authLimiter,
    validate({ body: schemas.register }),
    register,
);

router.post("/login", authLimiter, validate({ body: schemas.login }), login);

router.get("/me", authMiddleware, me);

module.exports = router;
