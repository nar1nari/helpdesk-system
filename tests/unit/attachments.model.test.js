const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const config = require("../../src/config");
const db = require("../../src/db");
const User = require("../../src/models/users");
const Category = require("../../src/models/category");
const Request = require("../../src/models/requests");
const Attachment = require("../../src/models/attachments");

const uploadDir = config.uploadDir;

const listUploads = () => fs.readdir(uploadDir).catch(() => []);

describe("Attachment model", () => {
    let sourceDir;
    let filesBefore;
    let request;

    beforeAll(async () => {
        await fs.mkdir(uploadDir, { recursive: true });
        sourceDir = await fs.mkdtemp(
            path.join(os.tmpdir(), "attachments-src-"),
        );
        filesBefore = new Set(await listUploads());
    });

    afterAll(async () => {
        await fs.rm(sourceDir, { recursive: true, force: true });

        for (const name of await listUploads()) {
            if (!filesBefore.has(name)) {
                await fs.rm(path.join(uploadDir, name), {
                    force: true,
                });
            }
        }
    });

    beforeEach(async () => {
        const user = await User.create("alice", "secret123");
        const category = await Category.add("category1");

        request = await Request.create(
            user.id,
            category.id,
            "Test request",
            "Test description",
        );
    });

    async function makeFile(originalname, content = "hello") {
        const ext = path.extname(originalname).toLowerCase();
        const filename = `${crypto.randomUUID()}${ext}`;
        const filePath = path.join(uploadDir, filename);

        await fs.writeFile(filePath, content);

        return {
            path: filePath,
            filename,
            originalname,
            mimetype: originalname.toLowerCase().endsWith(".pdf")
                ? "application/pdf"
                : "text/plain",
            size: Buffer.byteLength(content),
        };
    }

    describe("create()", () => {
        test("stores attachment metadata without copying the file", async () => {
            const file = await makeFile("report.txt", "file content");
            const statBefore = await fs.stat(file.path);

            const attachment = await Attachment.create(request.id, file);

            expect(attachment).toMatchObject({
                request_id: request.id,
                file_path: file.filename,
                original_name: "report.txt",
                mime_type: "text/plain",
                size_bytes: Buffer.byteLength("file content"),
            });
            expect(attachment.id).toBeDefined();

            expect(await fs.readFile(file.path, "utf8")).toBe("file content");

            const statAfter = await fs.stat(file.path);
            expect(statAfter.ino).toBe(statBefore.ino);
        });

        test("does not rename the file stored by the upload middleware", async () => {
            const file = await makeFile("SCAN.PDF");

            const attachment = await Attachment.create(request.id, file);

            expect(attachment.file_path).toBe(file.filename);
            expect(attachment.file_path).toMatch(/\.pdf$/);
            expect(attachment.original_name).toBe("SCAN.PDF");
            await expect(fs.access(file.path)).resolves.toBeUndefined();
        });

        test("supports filenames without an extension", async () => {
            const file = await makeFile("README");

            const attachment = await Attachment.create(request.id, file);

            expect(attachment.file_path).toBe(file.filename);
            expect(attachment.original_name).toBe("README");
        });

        test("strips directory components from the original name", async () => {
            const file = await makeFile("../../etc/passwd.txt");
            file.originalname = "../../etc/passwd.txt";

            const attachment = await Attachment.create(request.id, file);

            expect(attachment.original_name).toBe("passwd.txt");
        });

        test("truncates the original name to 255 characters", async () => {
            const name = `${"a".repeat(250)}.txt`;
            const file = await makeFile("long.txt");
            file.originalname = name;

            const attachment = await Attachment.create(request.id, file);

            expect(attachment.original_name).toBe(
                path.basename(name).slice(-255),
            );
            expect(attachment.original_name.length).toBeLessThanOrEqual(255);
        });

        test("does not delete the uploaded file when insertion fails", async () => {
            const file = await makeFile("report.txt");

            await expect(Attachment.create(-1, file)).rejects.toThrow();

            await expect(fs.access(file.path)).resolves.toBeUndefined();
        });
    });

    describe("get()", () => {
        test("returns the attachment with its absolute path", async () => {
            const file = await makeFile("report.txt", "file content");

            const created = await Attachment.create(request.id, file);

            const attachment = await Attachment.get(created.id);

            expect(attachment).toMatchObject({
                id: created.id,
                request_id: request.id,
                original_name: "report.txt",
                file_path: file.filename,
            });

            expect(attachment.absolute_path).toBe(
                path.join(uploadDir, file.filename),
            );

            expect(await fs.readFile(attachment.absolute_path, "utf8")).toBe(
                "file content",
            );
        });

        test("returns null for an unknown attachment", async () => {
            expect(await Attachment.get(-1)).toBeNull();
        });

        test("keeps absolute_path inside the upload directory", async () => {
            const file = await makeFile("report.txt");
            const created = await Attachment.create(request.id, file);

            await db.query(
                `UPDATE request_attachments
                 SET file_path = $1 WHERE id = $2`,
                ["../../etc/passwd", created.id],
            );

            const attachment = await Attachment.get(created.id);

            expect(attachment.absolute_path).toBe(
                path.join(uploadDir, "passwd"),
            );
        });
    });

    describe("listForRequest()", () => {
        test("returns public attachment metadata in upload order", async () => {
            const firstFile = await makeFile("first.txt");
            const secondFile = await makeFile("second.txt");

            await Attachment.create(request.id, firstFile);
            await Attachment.create(request.id, secondFile);

            const attachments = await Attachment.listForRequest(request.id);

            expect(attachments).toHaveLength(2);
            expect(attachments.map((item) => item.original_name)).toEqual([
                "first.txt",
                "second.txt",
            ]);

            expect(attachments[0]).not.toHaveProperty("absolute_path");
            expect(attachments[0]).not.toHaveProperty("file_path");
        });
    });

    describe("countForRequest()", () => {
        test("returns the number of attachments for a request", async () => {
            expect(await Attachment.countForRequest(request.id)).toBe(0);

            await Attachment.create(request.id, await makeFile("first.txt"));

            expect(await Attachment.countForRequest(request.id)).toBe(1);
        });
    });
});
