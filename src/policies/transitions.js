const { conflict, forbidden } = require("../errors");
const { Role } = require("../models/users");

const TRANSITIONS = {
    new: {
        in_progress: [Role.OPERATOR, Role.ADMIN],
        rejected: [Role.OPERATOR, Role.ADMIN],
    },
    in_progress: {
        pending: [Role.OPERATOR, Role.ADMIN],
        resolved: [Role.OPERATOR, Role.ADMIN],
        rejected: [Role.OPERATOR, Role.ADMIN],
    },
    pending: {
        in_progress: [Role.APPLICANT, Role.OPERATOR, Role.ADMIN],
        rejected: [Role.OPERATOR, Role.ADMIN],
    },
    resolved: {
        closed: [Role.APPLICANT, Role.ADMIN],
        in_progress: [Role.APPLICANT, Role.OPERATOR, Role.ADMIN],
    },
    closed: {},
    rejected: {},
};

exports.assertCanTransition = (user, request, to) => {
    const allowedRoles = TRANSITIONS[request.status]?.[to];
    if (!allowedRoles)
        throw conflict(`Cannot change status from ${request.status} to ${to}`);
    const owns =
        (user.role === Role.APPLICANT && request.user_id === user.id) ||
        (user.role === Role.OPERATOR &&
            request.assigned_operator_id === user.id) ||
        user.role === Role.ADMIN;
    if (!owns || !allowedRoles.includes(user.role)) throw forbidden();
};
