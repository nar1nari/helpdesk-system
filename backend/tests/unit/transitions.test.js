const { assertCanTransition } = require("../../src/policies/transitions");

const applicant = { id: 1, role: "applicant" };
const operator = { id: 10, role: "operator" };
const admin = { id: 99, role: "admin" };

const makeRequest = (status, overrides = {}) => ({
    user_id: 1,
    assigned_operator_id: 10,
    status,
    ...overrides,
});

describe("assertCanTransition", () => {
    test("operator can start work on a new request", () => {
        expect(() =>
            assertCanTransition(operator, makeRequest("new"), "in_progress"),
        ).not.toThrow();
    });

    test("applicant can reopen a resolved request", () => {
        expect(() =>
            assertCanTransition(
                applicant,
                makeRequest("resolved"),
                "in_progress",
            ),
        ).not.toThrow();
    });

    test("applicant can answer a pending request", () => {
        expect(() =>
            assertCanTransition(
                applicant,
                makeRequest("pending"),
                "in_progress",
            ),
        ).not.toThrow();
    });

    test("admin can close a resolved request", () => {
        expect(() =>
            assertCanTransition(admin, makeRequest("resolved"), "closed"),
        ).not.toThrow();
    });

    test("409 for a transition that does not exist", () => {
        expect(() =>
            assertCanTransition(admin, makeRequest("new"), "closed"),
        ).toThrow(expect.objectContaining({ status: 409 }));
    });

    test.each(["closed", "rejected"])(
        "409 for any change from %s",
        (status) => {
            expect(() =>
                assertCanTransition(admin, makeRequest(status), "new"),
            ).toThrow(expect.objectContaining({ status: 409 }));
        },
    );

    test("403 when the role is not allowed", () => {
        expect(() =>
            assertCanTransition(operator, makeRequest("resolved"), "closed"),
        ).toThrow(expect.objectContaining({ status: 403 }));
    });

    test("403 when the operator is not assigned to the request", () => {
        const request = makeRequest("new", { assigned_operator_id: 11 });
        expect(() =>
            assertCanTransition(operator, request, "in_progress"),
        ).toThrow(expect.objectContaining({ status: 403 }));
    });

    test("403 when the applicant does not own the request", () => {
        const request = makeRequest("resolved", { user_id: 2 });
        expect(() => assertCanTransition(applicant, request, "closed")).toThrow(
            expect.objectContaining({ status: 403 }),
        );
    });
});
