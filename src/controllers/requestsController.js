const Request = require("../models/requests");
const User = require("../models/users");

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
    const user = await User.find(req.user.username);

    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { category_id, title, description } = req.body;

    if (!category_id || !title || !description) {
        return res.status(400).json({
            message: "category_id, title and description are required",
        });
    }

    res.json({
        request: await Request.create(user.id, category_id, title, description),
    });
};

exports.get = async (req, res) => {
    const user = await User.find(req.user.username);

    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const request = await Request.get(req.params.id);

    if (!request) {
        return res.status(404).json({ message: "Request not found" });
    }

    if (!canView(user, request)) {
        return res.status(403).json({ message: "Forbidden" });
    }

    res.json({ request });
};

exports.set_status = async (req, res) => {
    const user = await User.find(req.user.username);

    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const request = await Request.get(req.params.id);

    if (!request) {
        return res.status(404).json({ message: "Request not found" });
    }

    const allowed =
        user.role === "admin" ||
        (user.role === "operator" && request.assigned_operator_id === user.id);

    if (!allowed) {
        return res.status(403).json({ message: "Forbidden" });
    }

    if (!Object.values(Request.Status).includes(req.body.status)) {
        return res.status(400).json({ message: "Invalid status" });
    }

    res.json({
        status: await Request.set_status(req.params.id, req.body.status),
    });
};

exports.list = async (req, res, next) => {
    try {
        const user = await User.find(req.user.username);

        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const result = await Request.list({
            ...req.query,
            currentUserId: user.id,
            currentUserRole: user.role,
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
};

exports.assign_operator = async (req, res) => {
    const user = await User.find(req.user.username);

    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

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
        user.role === "admin" ||
        (user.role === "operator" &&
            request.assigned_operator_id === null &&
            operatorId === user.id);

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
