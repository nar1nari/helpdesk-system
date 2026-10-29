const TOKEN_KEY = "token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) =>
    t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

async function request(path, { method = "GET", body, query, raw } = {}) {
    const url = new URL(`/api${path}`, window.location.origin);
    for (const [k, v] of Object.entries(query ?? {}))
        if (v !== "" && v != null) url.searchParams.set(k, v);

    const headers = {};
    if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
    if (body && !(body instanceof FormData))
        headers["Content-Type"] = "application/json";

    const res = await fetch(url, {
        method,
        headers,
        body:
            body instanceof FormData || body === undefined
                ? body
                : JSON.stringify(body),
    });
    if (raw && res.ok) return res;

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error?.message ?? `Error ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

export const api = {
    login: (username, password) =>
        request("/auth/login", {
            method: "POST",
            body: { username, password },
        }),
    register: (username, password) =>
        request("/auth/register", {
            method: "POST",
            body: { username, password },
        }),
    me: () => request("/auth/me"),

    categories: () => request("/categories"),
    addCategory: (name) =>
        request("/categories", { method: "POST", body: { name } }),
    renameCategory: (id, name) =>
        request(`/categories/${id}`, { method: "PATCH", body: { name } }),
    deleteCategory: (id) => request(`/categories/${id}`, { method: "DELETE" }),

    requests: (query) => request("/requests", { query }),
    request: (id) => request(`/requests/${id}`),
    createRequest: (body) => request("/requests", { method: "POST", body }),
    setStatus: (id, status) =>
        request(`/requests/${id}/status`, {
            method: "PATCH",
            body: { status },
        }),
    history: (id) => request(`/requests/${id}/status`),
    assign: (id, operator_id) =>
        request(`/requests/${id}/assign`, {
            method: "PATCH",
            body: { operator_id },
        }),

    deleteRequest: (id) => request(`/requests/${id}`, { method: "DELETE" }),

    comments: (id) => request(`/requests/${id}/comments`),
    addComment: (id, content) =>
        request(`/requests/${id}/comments`, {
            method: "POST",
            body: { content },
        }),

    deleteComment: (id, commentId) =>
        request(`/requests/${id}/comments/${commentId}`, { method: "DELETE" }),

    attachments: (id) => request(`/requests/${id}/attachments`),
    upload: (id, file) => {
        const form = new FormData();
        form.append("file", file);
        return request(`/requests/${id}/attachments`, {
            method: "POST",
            body: form,
        });
    },
    deleteAttachment: (id) =>
        request(`/attachments/${id}`, { method: "DELETE" }),
    download: async (attachment) => {
        const res = await request(`/attachments/${attachment.id}`, {
            raw: true,
        });
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement("a");
        a.href = url;
        a.download = attachment.original_name;
        a.click();
        URL.revokeObjectURL(url);
    },

    notifications: (query) => request("/notifications", { query }),
    markNotificationRead: (id) =>
        request(`/notifications/${id}/read`, { method: "PATCH" }),
    markAllNotificationsRead: () =>
        request("/notifications/read-all", { method: "POST" }),

    users: () => request("/admin/users"),
    createUser: (body) => request("/admin/users", { method: "POST", body }),
    updateUser: (id, body) =>
        request(`/admin/users/${id}`, { method: "PATCH", body }),
};
