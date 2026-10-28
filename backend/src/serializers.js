exports.request = (row) => {
    const result = { ...row };
    delete result.user_id;
    delete result.category_id;
    delete result.assigned_operator_id;
    return result;
};
