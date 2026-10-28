const { z } = require("zod");
const validate = require("../../src/middlewares/validate");

describe("validate middleware", () => {
    const schemas = {
        params: z.object({ id: z.coerce.number() }),
        body: z.object({ name: z.string() }),
    };

    test("replaces req parts with parsed data and calls next()", () => {
        const req = { params: { id: "5" }, body: { name: "x" } };
        const next = jest.fn();

        validate(schemas)(req, {}, next);

        expect(req.params).toEqual({ id: 5 });
        expect(next).toHaveBeenCalledWith();
    });

    test("skips parts that have no schema", () => {
        const req = { params: { id: "abc" }, body: { name: "x" } };
        const next = jest.fn();

        validate({ body: schemas.body })(req, {}, next);

        expect(next).toHaveBeenCalledWith();
    });

    test("uses an empty object when the part is missing", () => {
        const next = jest.fn();

        validate({ body: schemas.body })({}, {}, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ status: 400 }),
        );
    });

    test("400 with details when data is invalid", () => {
        const req = { params: { id: "5" }, body: { name: 123 } };
        const next = jest.fn();

        validate(schemas)(req, {}, next);

        const err = next.mock.calls[0][0];
        expect(err.status).toBe(400);
        expect(err.message).toBe("Validation failed");
        expect(err.details).toEqual([
            { path: "name", message: expect.any(String) },
        ]);
    });
});
