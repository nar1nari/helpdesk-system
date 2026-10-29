const express = require("express");
const {
    list,
    markRead,
    markAllRead,
} = require("../controllers/notificationsController");
const authMiddleware = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validate");
const { idParams } = require("../validators/common");
const { list: listSchema } = require("../validators/notifications");

const router = express.Router();
router.use(authMiddleware);

router.get("/", validate({ query: listSchema }), list);
router.post("/read-all", markAllRead);
router.patch("/:id/read", validate({ params: idParams }), markRead);

module.exports = router;
