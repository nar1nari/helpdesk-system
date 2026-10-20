const request = require("supertest");
const os = require("os");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const createApp = require("../helpers/createApp");
const db = require("../../src/db");
const Category = require("../../src/models/categories");
const Request = require("../../src/models/requests");
const Attachment = require("../../src/models/attachments");
const createAuthHelpers = require("../helpers/authHelpers");

const FIELD = "file";
const uploadDir = path.resolve("uploads/attachments");

const listUploads = () => fs.readdir(uploadDir).catch(() => []);

describe("Attachments API", () => {
    let app;
    let category;
    let signUp;
    let auth;
    let sourceDir;
    let filesBefore;

    beforeAll(async () => {
        sourceDir = await fs.mkdtemp(
            path.join(os.tmpdir(), "attachments-src-"),
        );
        filesBefore = new Set(await listUploads());
    });

    afterAll(async () => {
        await fs.rm(sourceDir, { recursive: true, force: true });

        for (const name of await listUploads()) {
            if (!filesBefore.has(name)) {
                await fs.rm(path.join(uploadDir, name), { force: true });
            }
        }
    });

    beforeEach(async () => {
        app = createApp();
        ({ signUp, auth } = createAuthHelpers(app));
        category = await Category.add("category1");
    });

    const createRequestFor = (user) =>
        Request.create(
            user.id,
            category.id,
            "Test request",
            "Test description",
        );

    async function addAttachment(
        request_id,
        name = "report.txt",
        content = "hello world",
    ) {
        const filePath = path.join(sourceDir, crypto.randomUUID());
        await fs.writeFile(filePath, content);
        return Attachment.create(request_id, {
            path: filePath,
            originalname: name,
        });
    }

    const upload = (
        token,
        request_id,
        content = "hello world",
        name = "report.txt",
    ) =>
        request(app)
            .post(`/requests/${request_id}/attachments`)
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

        test("401 for a valid token of a deleted user", async () => {
            const ghost = await signUp("ghost");
            const created = await createRequestFor(ghost.user);
            await db.query("DELETE FROM requests WHERE id = $1", [created.id]);
            await db.query("DELETE FROM users WHERE username = $1", ["ghost"]);

            const res = await upload(ghost.token, created.id);

            expect(res.status).toBe(401);
        });

        test("404 for unknown request", async () => {
            const alice = await signUp("alice");

            const res = await upload(alice.token, 42);

            expect(res.status).toBe(404);
            expect(await countAttachments()).toBe(0);
        });

        test.each(["applicant", "operator", "admin"])(
            "404 when %s is not the request owner",
            async (role) => {
                const alice = await signUp("alice");
                const other = await signUp("other", role);
                const created = await createRequestFor(alice.user);

                const res = await upload(other.token, created.id);

                expect(res.status).toBe(404);
                expect(await countAttachments()).toBe(0);
            },
        );

        test("400 when no file is uploaded", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);

            const res = await request(app)
                .post(`/requests/${created.id}/attachments`)
                .set(auth(alice.token));

            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe("No file uploaded");
            expect(await countAttachments()).toBe(0);
        });

        test("uploads a file to own request", async () => {
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
            });
            expect(res.body.attachment.file_path).toMatch(
                /^attachments\/[0-9a-f-]{36}\.txt$/,
            );

            const stored = path.join(
                uploadDir,
                path.basename(res.body.attachment.file_path),
            );
            expect(await fs.readFile(stored, "utf8")).toBe("hello world");
            expect(await countAttachments()).toBe(1);
        });
    });

    describe("GET /attachments/:id", () => {
        test("401 without token", async () => {
            const res = await request(app).get("/attachments/1");
            expect(res.status).toBe(401);
        });

        test("401 for a valid token of a deleted user", async () => {
            const ghost = await signUp("ghost");
            await db.query("DELETE FROM users WHERE username = $1", ["ghost"]);

            const res = await request(app)
                .get("/attachments/1")
                .set(auth(ghost.token));

            expect(res.status).toBe(401);
        });

        test("404 for unknown attachment", async () => {
            const alice = await signUp("alice");

            const res = await request(app)
                .get("/attachments/42")
                .set(auth(alice.token));

            expect(res.status).toBe(404);
            expect(res.body.error.message).toBe("Attachment not found");
        });

        test("downloads the file with its original name", async () => {
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
            expect(res.headers["content-disposition"]).toContain(
                'filename="report.txt"',
            );
        });

        test("403 when applicant opens attachment of someone else's request", async () => {
            const alice = await signUp("alice");
            const bob = await signUp("bob");
            const created = await createRequestFor(alice.user);
            const attachment = await addAttachment(created.id);

            const res = await request(app)
                .get(`/attachments/${attachment.id}`)
                .set(auth(bob.token));

            expect(res.status).toBe(403);
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

        test("404 when the file is missing on disk", async () => {
            const alice = await signUp("alice");
            const created = await createRequestFor(alice.user);
            const attachment = await addAttachment(created.id);
            await fs.rm(
                path.join(uploadDir, path.basename(attachment.file_path)),
            );

            const res = await request(app)
                .get(`/attachments/${attachment.id}`)
                .set(auth(alice.token));

            expect(res.status).toBe(404);
        });
    });
});
