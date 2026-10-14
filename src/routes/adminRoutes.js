const express = require("express");
const {
    createUser,
    getStatusHistory,
    deleteUser,
} = require("../controllers/adminController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/requests/:id/status", authMiddleware, getStatusHistory);
router.post("/users", authMiddleware, createUser);
router.delete("/users/:username", authMiddleware, deleteUser);

module.exports = router;
