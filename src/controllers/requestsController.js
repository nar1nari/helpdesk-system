const Request = require("../models/requests");
const StatusHistory = require("../models/statusHistory");
const { notFound, forbidden, badRequest } = require("../errors");

function canView(user, request) {
    if (user.role === "admin") return true;
    if (user.role === "applicant") return request.user_id === user.id;
    if (user.role === "operator") {
        return (
            request.assigned_operator_id === null ||
            request.assigned_operator_id === user.id
        );
    }
    return false;
}

exports.create = async (req, res) => {
    const { category_id, title, description } = req.body;

    if (!category_id || !title || !description) {
        throw badRequest("category_id, title and description are required");
    }

    res.json({
        request: await Request.create(
            req.user.id,
            category_id,
            title,
            description,
        ),
    });
};

exports.get = async (req, res) => {
    const request = await Request.get(req.params.id);

    if (!request) {
        throw notFound("Request not found");
    }

    if (!canView(req.user, request)) {
        throw forbidden();
    }

    res.json({ request });
};

exports.set_status = async (req, res) => {
    const request = await Request.get(req.params.id);

    if (!request) {
        throw notFound("Request not found");
    }

    const allowed =
        req.user.role === "admin" ||
        (req.user.role === "operator" &&
            request.assigned_operator_id === req.user.id);

    if (!allowed) {
        throw forbidden();
    }

    if (!Object.values(Request.Status).includes(req.body.status)) {
        throw badRequest("Invalid status", req.body.status);
    }

    const old_status = request.status;
    const new_status = (
        await Request.set_status(req.params.id, req.body.status)
    ).status;

    await StatusHistory.create(
        req.params.id,
        req.user.id,
        old_status,
        new_status,
    );

    res.json({
        status: new_status,
    });
};

exports.list = async (req, res) => {
    const result = await Request.list({
        ...req.query,
        currentUserId: req.user.id,
        currentUserRole: req.user.role,
    });

    res.json(result);
};

exports.assign_operator = async (req, res) => {
    const request = await Request.get(req.params.id);

    if (!request) {
        throw notFound("Request not found");
    }

    const operatorId = Number(req.body.operator_id);

    if (!Number.isInteger(operatorId)) {
        throw badRequest("operator_id must be an integer");
    }

    const allowed =
        req.user.role === "admin" ||
        (req.user.role === "operator" &&
            request.assigned_operator_id === null &&
            operatorId === req.user.id);

    if (!allowed) {
        throw forbidden();
    }

    res.json({
        assigned_operator_id: await Request.assign_operator(
            req.params.id,
            operatorId,
        ),
    });
};
