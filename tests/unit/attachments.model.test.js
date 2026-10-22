const os = require("os");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");

const db = require("../../src/db");
const User = require("../../src/models/users");
const Category = require("../../src/models/category");
const Request = require("../../src/models/requests");
const Attachment = require("../../src/models/attachments");

const uploadDir = path.resolve("uploads/attachments");

const listUploads = () => fs.readdir(uploadDir).catch(() => []);

describe("Attachment model", () => {
    let sourceDir;
    let filesBefore;
    let request;

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
        const filePath = path.join(sourceDir, crypto.randomUUID());
        await fs.writeFile(filePath, content);
        return { path: filePath, originalname };
    }

    describe("create()", () => {
        test("copies the file to the upload dir and stores a row", async () => {
            const file = await makeFile("report.txt", "file content");

            const attachment = await Attachment.create(request.id, file);

            expect(attachment).toMatchObject({
                request_id: request.id,
                original_name: "report.txt",
            });
            expect(attachment.id).toBeDefined();
            expect(attachment.file_path).toMatch(
                /^attachments\/[0-9a-f-]{36}\.txt$/,
            );

            const stored = path.join(
                uploadDir,
                path.basename(attachment.file_path),
            );
            expect(await fs.readFile(stored, "utf8")).toBe("file content");
        });

        test("does not remove the source file", async () => {
            const file = await makeFile("report.txt");

            await Attachment.create(request.id, file);

            await expect(fs.access(file.path)).resolves.toBeUndefined();
        });

        test("lowercases the extension but keeps the original name", async () => {
            const file = await makeFile("SCAN.PDF");

            const attachment = await Attachment.create(request.id, file);

            expect(attachment.file_path).toMatch(/\.pdf$/);
            expect(attachment.original_name).toBe("SCAN.PDF");
        });

        test("supports files without extension", async () => {
            const file = await makeFile("README");

            const attachment = await Attachment.create(request.id, file);

            expect(attachment.file_path).toMatch(
                /^attachments\/[0-9a-f-]{36}$/,
            );
            expect(attachment.original_name).toBe("README");
        });

        test("strips directories from the original name", async () => {
            const file = await makeFile("../../etc/passwd.txt");

            const attachment = await Attachment.create(request.id, file);

            expect(attachment.original_name).toBe("passwd.txt");
            expect(attachment.file_path).toMatch(
                /^attachments\/[0-9a-f-]{36}\.txt$/,
            );
        });

        test("gives different stored names to files with the same name", async () => {
            const first = await Attachment.create(
                request.id,
                await makeFile("same.txt", "one"),
            );
            const second = await Attachment.create(
                request.id,
                await makeFile("same.txt", "two"),
            );

            expect(first.file_path).not.toBe(second.file_path);
            expect(
                await fs.readFile(
                    path.join(uploadDir, path.basename(first.file_path)),
                    "utf8",
                ),
            ).toBe("one");
            expect(
                await fs.readFile(
                    path.join(uploadDir, path.basename(second.file_path)),
                    "utf8",
                ),
            ).toBe("two");
        });

        test("removes the copied file and rethrows when the insert fails", async () => {
            const file = await makeFile("report.txt");
            const before = (await listUploads()).sort();

            await expect(Attachment.create(-1, file)).rejects.toThrow();

            expect((await listUploads()).sort()).toEqual(before);
        });
    });

    describe("get()", () => {
        test("returns the attachment with its absolute path", async () => {
            const created = await Attachment.create(
                request.id,
                await makeFile("report.txt", "file content"),
            );

            const attachment = await Attachment.get(created.id);

            expect(attachment).toMatchObject({
                id: created.id,
                request_id: request.id,
                original_name: "report.txt",
                file_path: created.file_path,
            });
            expect(attachment.absolute_path).toBe(
                path.join(uploadDir, path.basename(created.file_path)),
            );
            expect(await fs.readFile(attachment.absolute_path, "utf8")).toBe(
                "file content",
            );
        });

        test("returns null for unknown attachment", async () => {
            expect(await Attachment.get(-1)).toBeNull();
        });

        test("keeps absolute_path inside the upload dir", async () => {
            const created = await Attachment.create(
                request.id,
                await makeFile("report.txt"),
            );
            await db.query(
                "UPDATE request_attachments SET file_path = $1 WHERE id = $2",
                ["../../etc/passwd", created.id],
            );

            const attachment = await Attachment.get(created.id);

            expect(attachment.absolute_path).toBe(
                path.join(uploadDir, "passwd"),
            );
        });
    });
});
