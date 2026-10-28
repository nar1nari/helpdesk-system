jest.mock("../../src/models/requests", () => ({ get: jest.fn() }));

const RequestModel = require("../../src/models/requests");
const loadRequest = require("../../src/middlewares/loadRequest");

describe("loadRequest middleware", () => {
    const user = { id: 1, role: "applicant" };
    const req = () => ({ user, params: { id: 5 } });

    test("puts the request in req.request and calls next()", async () => {
        const found = { id: 5, user_id: 1 };
        RequestModel.get.mockResolvedValue(found);
        const request = req();
        const next = jest.fn();

        await loadRequest()(request, {}, next);

        expect(request.request).toBe(found);
        expect(next).toHaveBeenCalled();
    });

    test("404 when the request does not exist", async () => {
        RequestModel.get.mockResolvedValue(undefined);

        await expect(loadRequest()(req(), {}, jest.fn())).rejects.toMatchObject(
            {
                status: 404,
            },
        );
    });

    test("404 when the check function says no", async () => {
        RequestModel.get.mockResolvedValue({ id: 5, user_id: 2 });
        const deny = jest.fn().mockReturnValue(false);

        await expect(
            loadRequest(deny)(req(), {}, jest.fn()),
        ).rejects.toMatchObject({ status: 404 });
        expect(deny).toHaveBeenCalledWith(user, { id: 5, user_id: 2 });
    });
});
