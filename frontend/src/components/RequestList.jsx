import { useEffect, useState } from "react";
import { api } from "../api";
import { ErrorAlert, StatusBadge } from "./ui";
import { fmtDate, STATUS_BADGE } from "./format";

export default function RequestList({ onOpen }) {
    const [filters, setFilters] = useState({ search: "", status: "", category_id: "" });
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [categories, setCategories] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        api.requests({ ...filters, page, limit: 10 })
            .then(setData)
            .catch((e) => setError(e.message));
    }, [filters, page]);

    useEffect(() => {
        api.categories().then((r) => setCategories(r.categories));
    }, []);

    const setFilter = (key) => (e) => {
        setPage(1);
        setFilters({ ...filters, [key]: e.target.value });
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 items-center">
                <h2 className="text-xl font-bold mr-auto">Requests</h2>
                <input
                    className="input"
                    placeholder="Search…"
                    value={filters.search}
                    onChange={setFilter("search")}
                />
                <select className="select" value={filters.status} onChange={setFilter("status")}>
                    <option value="">All statuses</option>
                    {Object.keys(STATUS_BADGE).map((s) => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                    ))}
                </select>
                <select className="select" value={filters.category_id} onChange={setFilter("category_id")}>
                    <option value="">All categories</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <button className="btn btn-primary" onClick={() => document.getElementById("new-request").showModal()}>
                    New request
                </button>
            </div>

            <ErrorAlert error={error} />

            <div className="overflow-x-auto bg-base-100 rounded-box shadow">
                <table className="table table-zebra">
                    <thead>
                        <tr>
                            <th>#</th><th>Title</th><th>Category</th><th>Status</th>
                            <th>Author</th><th>Operator</th><th>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!data && (
                            <tr><td colSpan={7} className="text-center"><span className="loading loading-spinner" /></td></tr>
                        )}
                        {data?.requests.length === 0 && (
                            <tr><td colSpan={7} className="text-center">No requests found</td></tr>
                        )}
                        {data?.requests.map((r) => (
                            <tr key={r.id} className="hover:bg-base-300 cursor-pointer" onClick={() => onOpen(r.id)}>
                                <td>{r.id}</td>
                                <td>{r.title}</td>
                                <td>{r.category.name}</td>
                                <td><StatusBadge status={r.status} /></td>
                                <td>{r.user.username}</td>
                                <td>{r.assigned_operator?.username ?? "—"}</td>
                                <td>{fmtDate(r.created_at)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {data && data.pagination.totalPages > 1 && (
                <div className="join self-center">
                    <button className="join-item btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>«</button>
                    <button className="join-item btn pointer-events-none">
                        Page {page} / {data.pagination.totalPages}
                    </button>
                    <button className="join-item btn" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>»</button>
                </div>
            )}

            <NewRequestModal categories={categories} onCreated={(id) => onOpen(id)} />
        </div>
    );
}

function NewRequestModal({ categories, onCreated }) {
    const [error, setError] = useState("");

    async function submit(e) {
        e.preventDefault();
        const form = new FormData(e.target);
        try {
            const { request } = await api.createRequest({
                category_id: Number(form.get("category_id")),
                title: form.get("title"),
                description: form.get("description"),
            });
            e.target.reset();
            setError("");
            document.getElementById("new-request").close();
            onCreated(request.id);
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <dialog id="new-request" className="modal">
            <form onSubmit={submit} className="modal-box flex flex-col gap-3">
                <h3 className="font-bold text-lg">New request</h3>
                <ErrorAlert error={error} />
                <select name="category_id" className="select w-full" required defaultValue="">
                    <option value="" disabled>Category</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <input name="title" className="input w-full" placeholder="Title" maxLength={255} required />
                <textarea name="description" className="textarea w-full h-32" placeholder="Describe the problem" maxLength={5000} required />
                <div className="modal-action">
                    <button type="button" className="btn" onClick={() => document.getElementById("new-request").close()}>Cancel</button>
                    <button className="btn btn-primary">Create</button>
                </div>
            </form>
            <form method="dialog" className="modal-backdrop"><button>close</button></form>
        </dialog>
    );
}
