const request = require("supertest");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const createApp = require("../helpers/createApp");
const config = require("../../src/config");
const db = require("../../src/db");
const Category = require("../../src/models/category");
const RequestModel = require("../../src/models/requests");
const Attachment = require("../../src/models/attachments");
const createAuthHelpers = require("../helpers/authHelpers");

const FIELD = "file";
const uploadDir = config.uploadDir;

describe("Attachments API", () => {
    let app;
    let category;
    let signUp;
    let auth;
    let sourceDir;
    let filesBefore;

    beforeAll(async () => {
        await fs.mkdir(uploadDir, { recursive: true });
        sourceDir = await fs.mkdtemp(
            path.join(os.tmpdir(), "attachments-src-"),
        );
        filesBefore = new Set(await fs.readdir(uploadDir));
    });

    afterAll(async () => {
        await fs.rm(sourceDir, { recursive: true, force: true });

        for (const name of await fs.readdir(uploadDir)) {
            if (!filesBefore.has(name)) {
                await fs.rm(path.join(uploadDir, name), {
                    force: true,
                });
            }
        }
    });

    beforeEach(async () => {
        app = createApp();
        ({ signUp, auth } = createAuthHelpers(app));
        category = await Category.add("category1");
    });

    const createRequestFor = (user) =>
        RequestModel.create(
            user.id,
            category.id,
            "Test request",
            "Test description",
        );

    async function addAttachment(
        requestId,
        name = "report.txt",
        content = "hello world",
    ) {
        const ext = path.extname(name).toLowerCase();
        const filename = `${crypto.randomUUID()}${ext}`;
        const filePath = path.join(uploadDir, filename);

        await fs.writeFile(filePath, content);

        return Attachment.create(requestId, {
            path: filePath,
            filename,
            originalname: name,
            mimetype: ext === ".pdf" ? "application/pdf" : "text/plain",
            size: Buffer.byteLength(content),
        });
    }

    const upload = (
        token,
        requestId,
        content = "hello world",
        name = "report.txt",
    ) =>
        request(app)
            .post(`/requests/${requestId}/attachments`)
            .set(auth(token))
            .attach(FIELD, Buffer.from(content), name);

    const countAttachments = async () =>
        (await db.query("SELECT COUNT(*)::int AS n FROM request_attachments"))
            .rows[0].n;

    describe("POST /requests/:id/attachments", () => {
        test("401 without token", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            const res = await request(app)
                .post(`/requests/${created.id}/attachments`)
                .attach(FIELD, Buffer.from("hello"), "report.txt");

            expect(res.status).toBe(401);
        });

        test("401 for a deleted user", async () => {
            const ghost = await signUp("ghost");
            const created = await createRequestFor(ghost.user);

            await db.query("DELETE FROM requests WHERE id = $1", [created.id]);
            await db.query("DELETE FROM users WHERE username = $1", ["ghost"]);

            const res = await upload(ghost.token, created.id);

            expect(res.status).toBe(401);
        });

        test("404 for an unknown request", async () => {
            const alice = await signUp("alice");

            const res = await upload(alice.token, 42);

            expect(res.status).toBe(404);
            expect(await countAttachments()).toBe(0);
        });

        test("400 when no file is uploaded", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            const res = await request(app)
                .post(`/requests/${created.id}/attachments`)
                .set(auth(alice.token));

            expect(res.status).toBe(400);
            expect(res.body.error.message).toContain("No file uploaded");
            expect(await countAttachments()).toBe(0);
        });

        test("uploads a file and returns public metadata", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            const res = await upload(
                alice.token,
                created.id,
                "hello world",
                "report.txt",
            );

            expect(res.status).toBe(201);

            expect(res.body.attachment).toMatchObject({
                request_id: created.id,
                original_name: "report.txt",
                mime_type: "text/plain",
                size_bytes: Buffer.byteLength("hello world"),
            });

            expect(res.body.attachment.id).toBeDefined();
            expect(res.body.attachment).not.toHaveProperty("file_path");
            expect(res.body.attachment).not.toHaveProperty("absolute_path");

            const [stored] = await fs.readdir(uploadDir);
            const attachment = await Attachment.get(res.body.attachment.id);

            expect(stored).toBeDefined();
            expect(attachment.file_path).toMatch(/^[0-9a-f-]{36}\.txt$/);
            expect(await fs.readFile(attachment.absolute_path, "utf8")).toBe(
                "hello world",
            );

            expect(await countAttachments()).toBe(1);
        });

        test("400 for a disallowed file extension", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            const res = await upload(
                alice.token,
                created.id,
                "<script>alert(1)</script>",
                "payload.html",
            );

            expect(res.status).toBe(400);
            expect(await countAttachments()).toBe(0);
        });
    });

    describe("GET /requests/:id/attachments", () => {
        test("returns attachment IDs and public metadata", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            await addAttachment(created.id, "first.txt");
            await addAttachment(created.id, "second.txt");

            const res = await request(app)
                .get(`/requests/${created.id}/attachments`)
                .set(auth(alice.token));

            expect(res.status).toBe(200);
            expect(res.body.attachments).toHaveLength(2);

            expect(
                res.body.attachments.map((item) => item.original_name),
            ).toEqual(["first.txt", "second.txt"]);

            for (const attachment of res.body.attachments) {
                expect(attachment.id).toBeDefined();
                expect(attachment).toHaveProperty("mime_type");
                expect(attachment).toHaveProperty("size_bytes");
                expect(attachment).not.toHaveProperty("file_path");
                expect(attachment).not.toHaveProperty("absolute_path");
            }
        });

        test("401 without token", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            const res = await request(app).get(
                `/requests/${created.id}/attachments`,
            );

            expect(res.status).toBe(401);
        });

        test("404 for an unknown request", async () => {
            const alice = await signUp("alice");

            const res = await request(app)
                .get("/requests/42/attachments")
                .set(auth(alice.token));

            expect(res.status).toBe(404);
        });

        test("404 when the user does not own the request", async () => {
            const alice = await signUp("alice");
            const bob = await signUp("bob");
            const created = await createRequestFor(alice.user);

            const res = await request(app)
                .get(`/requests/${created.id}/attachments`)
                .set(auth(bob.token));

            expect(res.status).toBe(404);
        });
    });

    describe("GET /attachments/:id", () => {
        test("401 without token", async () => {
            const res = await request(app).get("/attachments/1");
            expect(res.status).toBe(401);
        });

        test("401 for a deleted user", async () => {
            const ghost = await signUp("ghost");

            await db.query("DELETE FROM users WHERE username = $1", ["ghost"]);

            const res = await request(app)
                .get("/attachments/1")
                .set(auth(ghost.token));

            expect(res.status).toBe(401);
        });

        test("404 for an unknown attachment", async () => {
            const alice = await signUp("alice");

            const res = await request(app)
                .get("/attachments/42")
                .set(auth(alice.token));

            expect(res.status).toBe(404);
            expect(res.body.error.message).toBe("Attachment not found");
        });

        test("downloads the file using its original name", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            const attachment = await addAttachment(
                created.id,
                "report.txt",
                "hello world",
            );

            const res = await request(app)
                .get(`/attachments/${attachment.id}`)
                .set(auth(alice.token));

            expect(res.status).toBe(200);
            expect(res.text).toBe("hello world");
            expect(res.headers["content-disposition"]).toMatch(
                /filename="?report\.txt"?/,
            );
        });

        test("404 when an applicant downloads another user's attachment", async () => {
            const alice = await signUp("alice");
            const bob = await signUp("bob");
            const created = await createRequestFor(alice.user);
            const attachment = await addAttachment(created.id);

            const res = await request(app)
                .get(`/attachments/${attachment.id}`)
                .set(auth(bob.token));

            expect(res.status).toBe(404);
        });

        test("admin can download any attachment", async () => {
            const alice = await signUp("alice");
            const admin = await signUp("admin", "admin");
            const created = await createRequestFor(alice.user);
            const attachment = await addAttachment(created.id);

            const res = await request(app)
                .get(`/attachments/${attachment.id}`)
                .set(auth(admin.token));

            expect(res.status).toBe(200);
            expect(res.text).toBe("hello world");
        });

        test("404 when the file is missing from disk", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            const attachment = await addAttachment(created.id);

            await fs.rm(path.join(uploadDir, attachment.file_path));

            const res = await request(app)
                .get(`/attachments/${attachment.id}`)
                .set(auth(alice.token));

            expect(res.status).toBe(404);
        });
    });

    describe("upload edge cases", () => {
        beforeEach(() => {
            jest.spyOn(console, "error").mockImplementation(() => {});
        });

        afterEach(() => {
            console.error.mockRestore();
        });

        test("413 when the file is bigger than the limit", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            const tooBig = "a".repeat(config.uploadMaxBytes + 1);

            const res = await upload(alice.token, created.id, tooBig);

            expect(res.status).toBe(413);
            expect(await countAttachments()).toBe(0);
        });

        test("400 for a file without an extension", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            const res = await upload(alice.token, created.id, "x", "README");

            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe(
                "File type (none) is not allowed",
            );
        });

        test("400 when an extra text field is sent", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            const res = await upload(alice.token, created.id).field("a", "b");

            expect(res.status).toBe(400);
        });

        test("removes the saved file when the database insert fails", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            const spy = jest
                .spyOn(Attachment, "create")
                .mockRejectedValueOnce(new Error("db down"));
            const before = (await fs.readdir(uploadDir)).length;

            const res = await upload(alice.token, created.id);

            expect(res.status).toBe(500);
            expect((await fs.readdir(uploadDir)).length).toBe(before);
            spy.mockRestore();
        });

        test("still answers 500 when the cleanup of the file fails too", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            const createSpy = jest
                .spyOn(Attachment, "create")
                .mockRejectedValueOnce(new Error("db down"));
            const unlinkSpy = jest
                .spyOn(fs, "unlink")
                .mockRejectedValueOnce(new Error("disk error"));

            const res = await upload(alice.token, created.id);

            expect(res.status).toBe(500);
            expect(unlinkSpy).toHaveBeenCalled();
            createSpy.mockRestore();
            unlinkSpy.mockRestore();
        });
    });
});
