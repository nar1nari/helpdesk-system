const RequestModel = require("../models/requests");
const { notFound } = require("../errors");
const policy = require("../policies/requestPolicy");

module.exports =
    (check = policy.canView) =>
    async (req, res, next) => {
        const request = await RequestModel.get(req.params.id);
        if (!request || !check(req.user, request))
            throw notFound("Request not found");
        req.request = request;
        next();
    };
