const Request = require("../models/requests");
const Category = require("../models/categories");
const StatusHistory = require("../models/statusHistory");
const { notFound, forbidden, badRequest } = require("../errors");

exports.create = async (req, res) => {
    if (!(await Category.findById(req.body.category_id)))
        throw badRequest("Unknown category_id");

    res.status(201).json({
        request: await Request.create(
            req.user.id,
            req.body.category_id,
            req.body.title,
            req.body.description,
        ),
    });
};

exports.get = async (req, res) => {
    const request = await Request.get(req.params.id);

    res.json({ request });
};

exports.set_status = async (req, res) => {
    const request = await Request.get(req.params.id);

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
    const {
        status,
        category_id,
        assigned_operator_id,
        date_from,
        date_to,
        search,
        sort_by,
        sort_order,
        page,
        limit,
    } = req.query;

    const result = await Request.list({
        status,
        category_id,
        assigned_operator_id,
        date_from,
        date_to,
        search,
        sort_by,
        sort_order,
        page,
        limit,
        user: req.user,
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
