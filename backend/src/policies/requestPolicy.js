const { Role } = require("../models/users");

exports.canView = (user, request) => {
    switch (user.role) {
        case Role.ADMIN:
            return true;
        case Role.OPERATOR:
            return (
                request.assigned_operator_id === null ||
                request.assigned_operator_id === user.id
            );
        case Role.APPLICANT:
            return request.user_id === user.id;
        default:
            return false;
    }
};

exports.canAssign = (user, request, operatorId) =>
    user.role === Role.ADMIN ||
    (user.role === Role.OPERATOR &&
        request.assigned_operator_id === null &&
        operatorId === user.id);

exports.canChangeStatus = (user, request) =>
    user.role === Role.ADMIN ||
    (user.role === Role.OPERATOR && request.assigned_operator_id === user.id) ||
    (user.role === Role.APPLICANT &&
        request.user_id === user.id &&
        request.status === "resolved");

const isAdmin = (user) => user.role === Role.ADMIN;

exports.canDeleteRequest = (user, request) =>
    isAdmin(user) || request.user_id === user.id;

exports.canDeleteComment = (user, comment) =>
    isAdmin(user) || comment.author_id === user.id;

exports.canDeleteAttachment = (user, attachment) =>
    isAdmin(user) ||
    (attachment.uploaded_by != null && attachment.uploaded_by === user.id);
