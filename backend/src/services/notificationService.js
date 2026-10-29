const db = require("../db");
const Notification = require("../models/notifications");

const { Type } = Notification;

async function recipientsFor(request, actorId) {
    const candidates = [request.user_id, request.assigned_operator_id].filter(
        (id) => id != null && id !== actorId,
    );
    if (candidates.length === 0) return [];

    const { rows } = await db.query(
        "SELECT id FROM users WHERE id = ANY($1::int[]) AND is_active",
        [[...new Set(candidates)]],
    );
    return rows.map((r) => r.id);
}

async function notify(request, actor, type, meta = {}) {
    try {
        const userIds = await recipientsFor(request, actor.id);
        return await Notification.createMany(userIds, {
            requestId: request.id,
            actorId: actor.id,
            type,
            meta,
        });
    } catch (err) {
        console.error("Failed to create notifications", err);
        return 0;
    }
}

module.exports = {
    Type,
    recipientsFor,
    notify,
    statusChanged: (request, actor, oldStatus, newStatus) =>
        notify(request, actor, Type.STATUS_CHANGED, {
            old_status: oldStatus,
            new_status: newStatus,
        }),
    commentAdded: (request, actor) =>
        notify(request, actor, Type.COMMENT_ADDED),
    commentDeleted: (request, actor) =>
        notify(request, actor, Type.COMMENT_DELETED),
    fileAdded: (request, actor, originalName) =>
        notify(request, actor, Type.FILE_ADDED, {
            original_name: originalName,
        }),
    fileDeleted: (request, actor, originalName) =>
        notify(request, actor, Type.FILE_DELETED, {
            original_name: originalName,
        }),
};
