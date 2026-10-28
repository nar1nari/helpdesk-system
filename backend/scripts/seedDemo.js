// Fills the database with demo data (users, requests, comments, attachments,
// status history) so the UI can be seen "in use".
//
//   node scripts/seedDemo.js           add demo data
//   node scripts/seedDemo.js --reset   remove previously added demo data first
//
// All demo users have the password below and a "demo_" username prefix.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const db = require("../src/db");
const config = require("../src/config");

const PASSWORD = "demo-password-123";
const PREFIX = "demo_";

const APPLICANTS = ["alice", "bob", "carol", "dave", "erin"];
const OPERATORS = ["olga", "oleg", "oscar"];
const CATEGORIES = [
    "Hardware",
    "Software",
    "Network",
    "Accounts and access",
    "Other",
];

// [category, title, description]
const TEMPLATES = [
    [
        "Hardware",
        "Laptop won't turn on",
        "My laptop doesn't react to the power button since this morning. The charger LED is on, but the screen stays black. I have a presentation tomorrow.",
    ],
    [
        "Hardware",
        "Second monitor not detected",
        "After the docking station was replaced, the second monitor is no longer detected. Tried a different HDMI cable, no change.",
    ],
    [
        "Hardware",
        "Keyboard keys are sticking",
        "Several keys (E, R and Space) stick and sometimes type twice. Looks like something was spilled on it.",
    ],
    [
        "Hardware",
        "Request for a new mouse",
        "The scroll wheel on my mouse is broken. Could I get a replacement?",
    ],
    [
        "Hardware",
        "Printer on 3rd floor jams constantly",
        "The printer next to room 304 jams on almost every job larger than 5 pages. Several colleagues have the same issue.",
    ],
    [
        "Software",
        "Cannot install Docker Desktop",
        "The installer fails with 'virtualization is not enabled'. I need Docker for the new project.",
    ],
    [
        "Software",
        "Office license expired",
        "Word shows a 'Product deactivated' banner and opens documents in read-only mode.",
    ],
    [
        "Software",
        "IDE crashes on startup",
        "Since the last update the IDE closes immediately after the splash screen. Log file attached.",
    ],
    [
        "Software",
        "Need access to the analytics dashboard",
        "I joined the marketing team last week and need view access to the analytics dashboard.",
    ],
    [
        "Software",
        "Slow performance of the CRM",
        "Opening a customer card takes 20+ seconds. It was instant a week ago.",
    ],
    [
        "Software",
        "Please install Figma on my workstation",
        "I'm starting design work for the mobile app and need Figma desktop installed.",
    ],
    [
        "Network",
        "VPN disconnects every few minutes",
        "Working from home, the VPN drops roughly every 10 minutes and I have to reconnect manually. Other people on my ISP are fine.",
    ],
    [
        "Network",
        "No Wi-Fi in meeting room B",
        "Laptops see the network but can't get an IP address in meeting room B. Affects every meeting there.",
    ],
    [
        "Network",
        "Cannot reach the staging server",
        "ssh to staging.internal times out since yesterday evening. Production is reachable.",
    ],
    [
        "Network",
        "Request to open port 8443",
        "Our test service listens on port 8443 and needs to be reachable from the office network.",
    ],
    [
        "Accounts and access",
        "Forgot my password",
        "I'm locked out of my account after too many attempts. Please reset it.",
    ],
    [
        "Accounts and access",
        "New employee onboarding: accounts needed",
        "A new developer starts on Monday. Please create an email account, VPN access and add her to the engineering group.",
    ],
    [
        "Accounts and access",
        "Access to shared drive revoked",
        "I can no longer open the Finance shared drive though I had access last month.",
    ],
    [
        "Accounts and access",
        "Two-factor codes not accepted",
        "I replaced my phone and the authenticator codes are rejected. Need 2FA reset.",
    ],
    [
        "Other",
        "Request for a standing desk",
        "My doctor recommended a standing desk. I can provide a note if needed.",
    ],
    [
        "Other",
        "Conference room booking system shows wrong time zone",
        "Bookings made in the calendar appear one hour off for people in the Warsaw office.",
    ],
    [
        "Other",
        "Suggestion: add a guest Wi-Fi password rotation",
        "Guest Wi-Fi password hasn't changed in over a year. Could we rotate it regularly?",
    ],
    [
        "Software",
        "Email signature is broken",
        "The company signature template shows raw HTML in replies on mobile.",
    ],
    [
        "Hardware",
        "Headset microphone has no sound",
        "Colleagues can't hear me in calls with my headset. It works on my phone.",
    ],
];

const OP_PICKUP = [
    "Hi, I've picked this up and I'm looking into it.",
    "Taking this one. Will update you shortly.",
    "Thanks for the report, I'm on it.",
];
const OP_QUESTION = [
    "Could you tell me your workstation ID and when this started exactly?",
    "Can you send a screenshot or the exact error message?",
    "Does it happen on a different network / device too?",
];
const OP_RESOLVED = [
    "This should be fixed now. Please check and confirm.",
    "I've applied a fix and verified it on my side. Let me know if it still happens.",
    "Done. Please confirm that everything works for you.",
];
const OP_REJECT = [
    "Rejected: this is outside the scope of IT support. Please contact your manager.",
    "Rejected: duplicate of an existing request.",
    "Rejected: requires approval from the security team first.",
];
const USER_FOLLOWUP = [
    "Any news on this?",
    "It's getting urgent, it blocks my work.",
    "Added more details above, hope it helps.",
];
const USER_CONFIRM = [
    "Confirmed, works now. Thanks!",
    "All good, thank you for the quick help.",
    "Works. Thanks!",
];

// Small deterministic PRNG so every run produces similar data.
let seed = 42;
const rand = () =>
    (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;

// Status paths: each entry is the list of statuses a request went through.
const PATHS = [
    { weight: 6, steps: [] }, // new
    { weight: 6, steps: ["in_progress"] },
    { weight: 4, steps: ["in_progress", "pending"] },
    { weight: 5, steps: ["in_progress", "resolved"] },
    { weight: 7, steps: ["in_progress", "resolved", "closed"] },
    { weight: 2, steps: ["rejected"] },
    { weight: 1, steps: ["in_progress", "pending", "in_progress", "resolved"] },
];
function pickPath() {
    let n = rand() * PATHS.reduce((s, p) => s + p.weight, 0);
    for (const p of PATHS) if ((n -= p.weight) < 0) return p.steps;
    return [];
}

const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
);
function makeAttachment(title) {
    const kind = pick(["log", "txt", "png", "pdf"]);
    const stamp = new Date().toISOString();
    if (kind === "png")
        return { name: "screenshot.png", mime: "image/png", data: PNG };
    if (kind === "pdf")
        return {
            name: "details.pdf",
            mime: "application/pdf",
            data: Buffer.from(
                `%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
            ),
        };
    if (kind === "log") {
        const lines = Array.from(
            { length: 40 },
            (_, i) =>
                `${stamp} [${pick(["INFO", "WARN", "ERROR"])}] demo log line ${i + 1} for "${title}"`,
        );
        return {
            name: "error.log",
            mime: "text/plain",
            data: Buffer.from(lines.join("\n") + "\n"),
        };
    }
    return {
        name: "notes.txt",
        mime: "text/plain",
        data: Buffer.from(`Extra notes for "${title}"\nCollected ${stamp}\n`),
    };
}

async function reset() {
    const { rows: files } = await db.query(
        `SELECT a.file_path FROM request_attachments a
         JOIN requests r ON r.id = a.request_id
         JOIN users u ON u.id = r.user_id WHERE u.username LIKE $1`,
        [`${PREFIX}%`],
    );
    for (const f of files)
        fs.rmSync(path.join(config.uploadDir, path.basename(f.file_path)), {
            force: true,
        });
    await db.query(
        "DELETE FROM requests WHERE user_id IN (SELECT id FROM users WHERE username LIKE $1)",
        [`${PREFIX}%`],
    );
    await db.query("DELETE FROM users WHERE username LIKE $1", [`${PREFIX}%`]);
    console.log("Removed previous demo data");
}

async function createUsers(names, role, hash) {
    const users = [];
    for (const n of names) {
        const { rows } = await db.query(
            `INSERT INTO users (username, password, role, created_at)
             VALUES ($1, $2, $3, now() - interval '60 days') RETURNING id, username`,
            [PREFIX + n, hash, role],
        );
        users.push(rows[0]);
    }
    return users;
}

const hoursAfter = (date, min, max) =>
    new Date(date.getTime() + (min + rand() * (max - min)) * 3600_000);

async function main() {
    if (process.argv.includes("--reset")) await reset();
    const { rows: existing } = await db.query(
        "SELECT 1 FROM users WHERE username LIKE $1 LIMIT 1",
        [`${PREFIX}%`],
    );
    if (existing.length)
        throw new Error(
            "Demo data already exists. Run with --reset to replace it.",
        );

    fs.mkdirSync(config.uploadDir, { recursive: true });
    for (const name of CATEGORIES)
        await db.query(
            "INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING",
            [name],
        );
    const { rows: categories } = await db.query(
        "SELECT id, name FROM categories",
    );
    const categoryId = Object.fromEntries(
        categories.map((c) => [c.name, c.id]),
    );

    const hash = await bcrypt.hash(PASSWORD, config.bcryptRounds);
    const applicants = await createUsers(APPLICANTS, "applicant", hash);
    const operators = await createUsers(OPERATORS, "operator", hash);

    let counts = { requests: 0, comments: 0, attachments: 0, history: 0 };

    for (const [category, title, description] of TEMPLATES) {
        // Each template is used once, sometimes twice by a different user.
        for (let copy = 0; copy < (chance(0.35) ? 2 : 1); copy++) {
            const author = pick(applicants);
            const steps = pickPath();
            // New requests are mostly unassigned; others always have an operator.
            const operator =
                steps.length || chance(0.2) ? pick(operators) : null;
            const created = new Date(
                Date.now() - (1 + rand() * 29) * 86400_000,
            );

            // Timeline: [{status, at, by}] used for history and the final state.
            const timeline = [];
            let t = created,
                old = "new";
            for (const s of steps) {
                t = hoursAfter(t, 1, 30);
                const by = s === "closed" ? author : operator;
                timeline.push({ old, status: s, at: t, by });
                old = s;
            }
            const last = timeline.at(-1)?.at ?? created;
            const finalStatus = timeline.at(-1)?.status ?? "new";

            const { rows } = await db.query(
                `INSERT INTO requests (user_id, category_id, title, description, status,
                                       assigned_operator_id, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [
                    author.id,
                    categoryId[category],
                    title,
                    description,
                    finalStatus,
                    operator?.id ?? null,
                    created,
                    last,
                ],
            );
            const requestId = rows[0].id;
            counts.requests++;

            for (const h of timeline) {
                await db.query(
                    `INSERT INTO request_status_history (request_id, changed_by, old_status, new_status, changed_at)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [requestId, h.by.id, h.old, h.status, h.at],
                );
                counts.history++;
            }

            // Comments that match what happened to the request.
            const comments = [];
            for (const h of timeline) {
                if (h.status === "in_progress" && h.old === "new") {
                    comments.push([h.by, pick(OP_PICKUP), h.at]);
                    if (chance(0.5))
                        comments.push([
                            author,
                            pick(USER_FOLLOWUP),
                            hoursAfter(h.at, 1, 8),
                        ]);
                }
                if (h.status === "pending")
                    comments.push([
                        h.by,
                        pick(OP_QUESTION),
                        hoursAfter(h.at, -0.2, 0),
                    ]);
                if (h.status === "resolved")
                    comments.push([
                        h.by,
                        pick(OP_RESOLVED),
                        hoursAfter(h.at, -0.2, 0),
                    ]);
                if (h.status === "closed")
                    comments.push([
                        author,
                        pick(USER_CONFIRM),
                        hoursAfter(h.at, -0.2, 0),
                    ]);
                if (h.status === "rejected")
                    comments.push([
                        h.by,
                        pick(OP_REJECT),
                        hoursAfter(h.at, -0.2, 0),
                    ]);
            }
            // A "new" request sometimes has a user note.
            if (!steps.length && chance(0.3))
                comments.push([
                    author,
                    "Please let me know if you need more info.",
                    hoursAfter(created, 1, 5),
                ]);

            comments.sort((a, b) => a[2] - b[2]);
            for (const [user, content, at] of comments) {
                await db.query(
                    "INSERT INTO request_comments (request_id, author_id, content, created_at) VALUES ($1, $2, $3, $4)",
                    [requestId, user.id, content, at < created ? created : at],
                );
                counts.comments++;
            }

            // Attachments: ~40% of requests get one or two files.
            if (chance(0.4)) {
                for (let i = 0; i < (chance(0.3) ? 2 : 1); i++) {
                    const a = makeAttachment(title);
                    const stored = crypto.randomUUID() + path.extname(a.name);
                    fs.writeFileSync(
                        path.join(config.uploadDir, stored),
                        a.data,
                    );
                    await db.query(
                        `INSERT INTO request_attachments (request_id, file_path, original_name, mime_type, size_bytes, uploaded_at)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            requestId,
                            stored,
                            a.name,
                            a.mime,
                            a.data.length,
                            hoursAfter(created, 0, 1),
                        ],
                    );
                    counts.attachments++;
                }
            }
        }
    }

    console.log(
        `Created ${applicants.length + operators.length} users, ${counts.requests} requests, ${counts.comments} comments, ${counts.attachments} attachments, ${counts.history} status changes.`,
    );
    console.log(
        `Log in as ${PREFIX}${APPLICANTS[0]} (applicant) or ${PREFIX}${OPERATORS[0]} (operator) with password "${PASSWORD}".`,
    );
}

main()
    .catch((e) => {
        console.error(e.message);
        process.exitCode = 1;
    })
    .finally(() => db.pool.end());
