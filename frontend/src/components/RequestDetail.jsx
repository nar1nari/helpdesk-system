import { useEffect, useState } from "react";
import { api } from "../api";
import { ErrorAlert, StatusBadge } from "./ui";
import { fmtDate } from "./format";

const TRANSITIONS = {
    new: { in_progress: ["operator", "admin"], rejected: ["operator", "admin"] },
    in_progress: {
        pending: ["operator", "admin"],
        resolved: ["operator", "admin"],
        rejected: ["operator", "admin"],
    },
    pending: {
        in_progress: ["applicant", "operator", "admin"],
        rejected: ["operator", "admin"],
    },
    resolved: {
        closed: ["applicant", "admin"],
        in_progress: ["applicant", "operator", "admin"],
    },
    closed: {},
    rejected: {},
};

export default function RequestDetail({ id, user, onBack }) {
    const [request, setRequest] = useState(null);
    const [comments, setComments] = useState([]);
    const [history, setHistory] = useState([]);
    const [attachments, setAttachments] = useState([]);
    const [operators, setOperators] = useState([]);
    const [error, setError] = useState("");

    const [version, setVersion] = useState(0);

    useEffect(() => {
        Promise.all([
            api.request(id), api.comments(id), api.history(id), api.attachments(id),
        ])
            .then(([r, c, h, a]) => {
                setRequest(r.request);
                setComments(c.comments);
                setHistory(h.status_history);
                setAttachments(a.attachments);
            })
            .catch((e) => setError(e.message));
    }, [id, version]);
    useEffect(() => {
        if (user.role === "admin")
            api.users().then((r) =>
                setOperators(r.users.filter((u) => u.is_active && u.role !== "applicant")),
            );
    }, [user.role]);

    const run = (fn) => async (...args) => {
        setError("");
        try {
            await fn(...args);
            setVersion((v) => v + 1);
        } catch (e) {
            setError(e.message);
        }
    };

    if (!request) return error ? <ErrorAlert error={error} /> : <span className="loading loading-spinner" />;

    const nextStatuses = Object.entries(TRANSITIONS[request.status])
        .filter(([, roles]) => roles.includes(user.role))
        .map(([status]) => status);
    const canAssignSelf =
        user.role !== "applicant" && !request.assigned_operator;
    const isClosed = ["closed", "rejected"].includes(request.status);
    // Only the author and an administrator may delete (hide) things.
    const isAdmin = user.role === "admin";
    const canDeleteRequest = isAdmin || request.user.id === user.id;
    const confirmDelete = (what) => window.confirm(`Delete this ${what}?`);

    return (
        <div className="flex flex-col gap-4">
            <div>
                <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
            </div>
            <ErrorAlert error={error} />

            <div className="card bg-base-100 shadow">
                <div className="card-body">
                    <h2 className="card-title">
                        #{request.id} {request.title} <StatusBadge status={request.status} />
                    </h2>
                    <p className="text-sm text-base-content/70">
                        {request.category.name} · by {request.user.username} · {fmtDate(request.created_at)}
                        <br />
                        Operator: {request.assigned_operator?.username ?? "unassigned"}
                    </p>
                    <p className="whitespace-pre-wrap">{request.description}</p>

                    <div className="card-actions items-center">
                        {nextStatuses.map((s) => (
                            <button key={s} className="btn btn-sm btn-outline" onClick={() => run(api.setStatus)(id, s)}>
                                Mark {s.replace("_", " ")}
                            </button>
                        ))}
                        {canAssignSelf && (
                            <button className="btn btn-sm btn-primary" onClick={() => run(api.assign)(id, user.id)}>
                                Assign to me
                            </button>
                        )}
                        {canDeleteRequest && (
                            <button
                                className="btn btn-sm btn-error btn-outline ml-auto"
                                onClick={async () => {
                                    if (!confirmDelete("request")) return;
                                    await run(api.deleteRequest)(id);
                                    onBack();
                                }}
                            >
                                Delete request
                            </button>
                        )}
                        {user.role === "admin" && (
                            <select
                                className="select select-sm w-auto"
                                value={request.assigned_operator?.id ?? ""}
                                onChange={(e) => run(api.assign)(id, Number(e.target.value))}
                            >
                                <option value="" disabled>Assign operator…</option>
                                {operators.map((o) => (
                                    <option key={o.id} value={o.id}>{o.username}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="card bg-base-100 shadow">
                    <div className="card-body">
                        <h3 className="card-title">Comments</h3>
                        {comments.length === 0 && <p className="text-base-content/70">No comments yet.</p>}
                        {comments.map((c) => (
                            <div key={c.id} className={`chat ${c.author.id === user.id ? "chat-end" : "chat-start"}`}>
                                <div className="chat-header">
                                    {c.author.username} <time className="text-xs opacity-60">{fmtDate(c.created_at)}</time>
                                </div>
                                <div className="chat-bubble whitespace-pre-wrap">{c.content}</div>
                                {(isAdmin || c.author.id === user.id) && (
                                    <div className="chat-footer">
                                        <button
                                            className="btn btn-xs btn-ghost text-error"
                                            onClick={() => confirmDelete("comment") && run(api.deleteComment)(id, c.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {!isClosed && (
                            <form
                                className="join w-full"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const form = e.target;
                                    run(api.addComment)(id, form.content.value).then(() => form.reset());
                                }}
                            >
                                <input name="content" className="input join-item w-full" placeholder="Write a comment" maxLength={5000} required />
                                <button className="btn btn-primary join-item">Send</button>
                            </form>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="card bg-base-100 shadow">
                        <div className="card-body">
                            <h3 className="card-title">Attachments</h3>
                            {attachments.length === 0 && <p className="text-base-content/70">No attachments.</p>}
                            <ul className="list">
                                {attachments.map((a) => (
                                    <li key={a.id} className="list-row items-center">
                                        <span className="list-col-grow">
                                            {a.original_name}
                                            <span className="text-xs opacity-60"> {Math.ceil(a.size_bytes / 1024)} KB</span>
                                        </span>
                                        <button className="btn btn-sm" onClick={() => run(api.download)(a)}>Download</button>
                                        {(isAdmin || a.uploaded_by === user.id) && (
                                            <button
                                                className="btn btn-sm btn-error btn-outline"
                                                onClick={() => confirmDelete("file") && run(api.deleteAttachment)(a.id)}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <input
                                type="file"
                                className="file-input w-full"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    e.target.value = "";
                                    if (file) run(api.upload)(id, file);
                                }}
                            />
                        </div>
                    </div>

                    <div className="card bg-base-100 shadow">
                        <div className="card-body">
                            <h3 className="card-title">Status history</h3>
                            {history.length === 0 && <p className="text-base-content/70">No changes yet.</p>}
                            <ul className="timeline timeline-vertical timeline-compact timeline-snap-icon">
                                {history.map((h) => (
                                    <li key={h.id}>
                                        <div className="timeline-middle">●</div>
                                        <div className="timeline-end timeline-box">
                                            {h.old_status} → {h.new_status}
                                            <div className="text-xs opacity-60">{h.changed_by.username} · {fmtDate(h.changed_at)}</div>
                                        </div>
                                        <hr />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
