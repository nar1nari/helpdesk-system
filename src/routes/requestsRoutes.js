const express = require("express");
const {
    create,
    get,
    set_status,
    list,
    assign_operator,
} = require("../controllers/requestsController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, list);
router.post("/", authMiddleware, create);
router.get("/{:id}", authMiddleware, get);
router.patch("/{:id}/status", authMiddleware, set_status);
router.patch("/{:id}/assign", authMiddleware, assign_operator);

module.exports = router;
