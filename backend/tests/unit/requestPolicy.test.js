const policy = require("../../src/policies/requestPolicy");

const applicant = { id: 1, role: "applicant" };
const otherApplicant = { id: 2, role: "applicant" };
const operator = { id: 10, role: "operator" };
const otherOperator = { id: 11, role: "operator" };
const admin = { id: 99, role: "admin" };

const makeRequest = (overrides = {}) => ({
    user_id: 1,
    assigned_operator_id: null,
    status: "new",
    ...overrides,
});

describe("canView", () => {
    test("admin can view any request", () => {
        expect(policy.canView(admin, makeRequest())).toBe(true);
    });

    test("applicant can view own request", () => {
        expect(policy.canView(applicant, makeRequest())).toBe(true);
    });

    test("applicant cannot view someone else's request", () => {
        expect(policy.canView(otherApplicant, makeRequest())).toBe(false);
    });

    test("operator can view an unassigned request", () => {
        expect(policy.canView(operator, makeRequest())).toBe(true);
    });

    test("operator can view a request assigned to them", () => {
        const request = makeRequest({ assigned_operator_id: 10 });
        expect(policy.canView(operator, request)).toBe(true);
    });

    test("operator cannot view a request assigned to another operator", () => {
        const request = makeRequest({ assigned_operator_id: 11 });
        expect(policy.canView(operator, request)).toBe(false);
    });

    test("unknown role cannot view anything", () => {
        expect(policy.canView({ id: 5, role: "guest" }, makeRequest())).toBe(
            false,
        );
    });
});

describe("canAssign", () => {
    test("admin can assign anyone", () => {
        const request = makeRequest({ assigned_operator_id: 11 });
        expect(policy.canAssign(admin, request, 10)).toBe(true);
    });

    test("operator can take an unassigned request", () => {
        expect(policy.canAssign(operator, makeRequest(), 10)).toBe(true);
    });

    test("operator cannot assign someone else", () => {
        expect(policy.canAssign(operator, makeRequest(), 11)).toBe(false);
    });

    test("operator cannot take an already assigned request", () => {
        const request = makeRequest({ assigned_operator_id: 11 });
        expect(policy.canAssign(operator, request, 10)).toBe(false);
    });

    test("applicant cannot assign", () => {
        expect(policy.canAssign(applicant, makeRequest(), 10)).toBe(false);
    });
});

describe("canChangeStatus", () => {
    test("admin can change any status", () => {
        expect(policy.canChangeStatus(admin, makeRequest())).toBe(true);
    });

    test("assigned operator can change status", () => {
        const request = makeRequest({ assigned_operator_id: 10 });
        expect(policy.canChangeStatus(operator, request)).toBe(true);
    });

    test("other operator cannot change status", () => {
        const request = makeRequest({ assigned_operator_id: 10 });
        expect(policy.canChangeStatus(otherOperator, request)).toBe(false);
    });

    test("applicant can change status of own resolved request", () => {
        const request = makeRequest({ status: "resolved" });
        expect(policy.canChangeStatus(applicant, request)).toBe(true);
    });

    test("applicant cannot change status of own request that is not resolved", () => {
        expect(policy.canChangeStatus(applicant, makeRequest())).toBe(false);
    });

    test("applicant cannot change status of someone else's request", () => {
        const request = makeRequest({ status: "resolved" });
        expect(policy.canChangeStatus(otherApplicant, request)).toBe(false);
    });
});

describe("canDeleteRequest", () => {
    test("admin can delete any request", () => {
        expect(policy.canDeleteRequest(admin, makeRequest())).toBe(true);
    });

    test("the author can delete their own request", () => {
        expect(policy.canDeleteRequest(applicant, makeRequest())).toBe(true);
    });

    test("another applicant cannot", () => {
        expect(policy.canDeleteRequest(otherApplicant, makeRequest())).toBe(
            false,
        );
    });

    test("an assigned operator who is not the author cannot", () => {
        const request = makeRequest({ assigned_operator_id: 10 });
        expect(policy.canDeleteRequest(operator, request)).toBe(false);
    });

    test("an operator can delete a request they authored", () => {
        expect(
            policy.canDeleteRequest(operator, makeRequest({ user_id: 10 })),
        ).toBe(true);
    });
});

describe("canDeleteComment", () => {
    const comment = { author_id: 1 };

    test("admin can delete any comment", () => {
        expect(policy.canDeleteComment(admin, comment)).toBe(true);
    });

    test("the author can delete their own comment", () => {
        expect(policy.canDeleteComment(applicant, comment)).toBe(true);
    });

    test("nobody else can, whatever their role", () => {
        expect(policy.canDeleteComment(otherApplicant, comment)).toBe(false);
        expect(policy.canDeleteComment(operator, comment)).toBe(false);
    });
});

describe("canDeleteAttachment", () => {
    test("admin can delete any attachment, even without a known uploader", () => {
        expect(policy.canDeleteAttachment(admin, { uploaded_by: 1 })).toBe(
            true,
        );
        expect(policy.canDeleteAttachment(admin, { uploaded_by: null })).toBe(
            true,
        );
    });

    test("the uploader can delete their own attachment", () => {
        expect(policy.canDeleteAttachment(applicant, { uploaded_by: 1 })).toBe(
            true,
        );
    });

    test("nobody else can", () => {
        expect(
            policy.canDeleteAttachment(otherApplicant, { uploaded_by: 1 }),
        ).toBe(false);
        expect(policy.canDeleteAttachment(operator, { uploaded_by: 1 })).toBe(
            false,
        );
    });

    test("an attachment with an unknown uploader is not deletable by non-admins", () => {
        expect(
            policy.canDeleteAttachment(applicant, { uploaded_by: null }),
        ).toBe(false);
        expect(
            policy.canDeleteAttachment(applicant, { uploaded_by: undefined }),
        ).toBe(false);
    });
});
