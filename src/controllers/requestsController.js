const Request = require("../models/requests");
const StatusHistory = require("../models/statusHistory");

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
        return res.status(400).json({
            message: "category_id, title and description are required",
        });
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
        return res.status(404).json({ message: "Request not found" });
    }

    if (!canView(req.user, request)) {
        return res.status(403).json({ message: "Forbidden" });
    }

    res.json({ request });
};

exports.set_status = async (req, res) => {
    const request = await Request.get(req.params.id);

    if (!request) {
        return res.status(404).json({ message: "Request not found" });
    }

    const allowed =
        req.user.role === "admin" ||
        (req.user.role === "operator" &&
            request.assigned_operator_id === req.user.id);

    if (!allowed) {
        return res.status(403).json({ message: "Forbidden" });
    }

    if (!Object.values(Request.Status).includes(req.body.status)) {
        return res.status(400).json({ message: "Invalid status" });
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

exports.list = async (req, res, next) => {
    try {
        const result = await Request.list({
            ...req.query,
            currentUserId: req.user.id,
            currentUserRole: req.user.role,
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
};

exports.assign_operator = async (req, res) => {
    const request = await Request.get(req.params.id);

    if (!request) {
        return res.status(404).json({ message: "Request not found" });
    }

    const operatorId = Number(req.body.operator_id);

    if (!Number.isInteger(operatorId)) {
        return res
            .status(400)
            .json({ message: "operator_id must be an integer" });
    }

    const allowed =
        req.user.role === "admin" ||
        (req.user.role === "operator" &&
            request.assigned_operator_id === null &&
            operatorId === req.user.id);

    if (!allowed) {
        return res.status(403).json({ message: "Forbidden" });
    }

    res.json({
        assigned_operator_id: await Request.assign_operator(
            req.params.id,
            operatorId,
        ),
    });
};
