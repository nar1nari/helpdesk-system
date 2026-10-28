const { z } = require("zod");
module.exports = {
    commentBody: z.object({ content: z.string().trim().min(1).max(5000) }),
};
