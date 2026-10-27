const RequestModel = require("../models/requests");
const Category = require("../models/category");
const StatusHistory = require("../models/statusHistory");
const { forbidden, badRequest } = require("../errors");
const User = require("../models/users");
const { canAssign } = require("../policies/requestPolicy");
const { assertCanTransition } = require("../policies/transitions");

exports.create = async (req, res) => {
    if (!(await Category.findById(req.body.category_id)))
        throw badRequest("Unknown category_id");

    res.status(201).json({
        request: await RequestModel.create(
            req.user.id,
            req.body.category_id,
            req.body.title,
            req.body.description,
        ),
    });
};

exports.get = async (req, res) => {
    res.json({ request: req.request });
};

exports.setStatus = async (req, res) => {
    const old_status = req.request.status;

    assertCanTransition(req.user, req.request, req.body.status);

    const updated = await RequestModel.setStatus(
        req.params.id,
        req.body.status,
    );

    await StatusHistory.create(
        req.params.id,
        req.user.id,
        old_status,
        req.body.status,
    );

    res.json({
        request: updated,
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

    const result = await RequestModel.list({
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

exports.assignOperator = async (req, res) => {
    if (!canAssign(req.user, req.request, req.body.operator_id)) {
        throw forbidden();
    }

    const operator = await User.findById(req.body.operator_id);
    if (!operator || !operator.is_active || operator.role === "applicant") {
        throw badRequest("operator_id must be an active operator or admin");
    }

    res.json({
        request: await RequestModel.assignOperator(
            req.params.id,
            req.body.operator_id,
        ),
    });
};

exports.getStatusHistory = async (req, res) => {
    const statusHistory = await StatusHistory.getBy(req.params.id);
    res.json({ status_history: statusHistory });
};
