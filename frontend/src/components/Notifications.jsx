import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { fmtDate } from "./format";

const POLL_MS = 30_000;

const describe = (n) => {
    const who = n.actor?.username ?? "Someone";
    switch (n.type) {
        case "status_changed":
            return `${who} changed the status: ${n.meta.old_status} → ${n.meta.new_status}`;
        case "comment_added":
            return `${who} added a comment`;
        case "comment_deleted":
            return `${who} deleted a comment`;
        case "file_added":
            return `${who} attached ${n.meta.original_name ?? "a file"}`;
        case "file_deleted":
            return `${who} deleted ${n.meta.original_name ?? "a file"}`;
        default:
            return `${who} updated the request`;
    }
};

export default function Notifications({ onOpen }) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);

    const load = useCallback(
        () =>
            api
                .notifications({ limit: 20 })
                .then((r) => {
                    setItems(r.notifications);
                    setUnread(r.unread_count);
                })
                .catch(() => {}),
        [],
    );

    useEffect(() => {
        load();
        const timer = setInterval(load, POLL_MS);
        return () => clearInterval(timer);
    }, [load]);

    const openItem = async (n) => {
        setOpen(false);
        if (!n.is_read) await api.markNotificationRead(n.id).catch(() => {});
        onOpen(n.request_id);
        load();
    };

    const readAll = async () => {
        await api.markAllNotificationsRead().catch(() => {});
        load();
    };

    return (
        <div className="relative">
            <button
                className="btn btn-sm btn-ghost"
                aria-label="Notifications"
                onClick={() => {
                    setOpen(!open);
                    if (!open) load();
                }}
            >
                🔔
                {unread > 0 && <span className="badge badge-sm badge-error">{unread}</span>}
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-96 max-w-[90vw] z-10 card bg-base-100 shadow-xl">
                    <div className="card-body p-3 gap-2">
                        <div className="flex items-center">
                            <h3 className="font-bold mr-auto">Notifications</h3>
                            <button className="btn btn-xs" disabled={unread === 0} onClick={readAll}>
                                Mark all read
                            </button>
                        </div>
                        {items.length === 0 && <p className="text-base-content/70">Nothing yet.</p>}
                        <ul className="max-h-96 overflow-y-auto flex flex-col gap-1">
                            {items.map((n) => (
                                <li key={n.id}>
                                    <button
                                        className={`w-full text-left rounded p-2 hover:bg-base-200 ${n.is_read ? "opacity-60" : "font-semibold"}`}
                                        onClick={() => openItem(n)}
                                    >
                                        <div className="text-sm">
                                            #{n.request_id} {n.request_title}
                                        </div>
                                        <div className="text-sm font-normal">{describe(n)}</div>
                                        <div className="text-xs opacity-60 font-normal">{fmtDate(n.created_at)}</div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
