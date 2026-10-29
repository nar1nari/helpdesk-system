const { z } = require("zod");
const id = z.coerce.number().int().positive().max(2147483647);
module.exports = {
    id,
    idParams: z.object({ id }),
    commentParams: z.object({ id, commentId: id }),
};
