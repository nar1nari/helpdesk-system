const Notification = require("../models/notifications");
const { notFound } = require("../errors");

exports.list = async (req, res) => {
    const { unread, page, limit } = req.query;
    const result = await Notification.listFor(req.user.id, {
        unreadOnly: unread,
        page,
        limit,
    });
    res.json({
        ...result,
        unread_count: await Notification.unreadCount(req.user.id),
    });
};

exports.markRead = async (req, res) => {
    const notification = await Notification.markRead(
        req.params.id,
        req.user.id,
    );
    if (!notification) throw notFound("Notification not found");
    res.json({ notification });
};

exports.markAllRead = async (req, res) => {
    res.json({ updated: await Notification.markAllRead(req.user.id) });
};
