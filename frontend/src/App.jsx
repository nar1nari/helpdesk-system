import { useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";
import AuthForm from "./components/AuthForm";
import RequestList from "./components/RequestList";
import RequestDetail from "./components/RequestDetail";
import Admin from "./components/Admin";
import Notifications from "./components/Notifications";

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(!!getToken());
    const [view, setView] = useState({ page: "requests" });

    const loadUser = () =>
        api.me()
            .then((r) => setUser(r.user))
            .catch(() => setToken(null))
            .finally(() => setLoading(false));

    useEffect(() => {
        if (getToken()) loadUser();
    }, []);

    const logout = () => {
        setToken(null);
        setUser(null);
        setView({ page: "requests" });
    };

    if (loading)
        return (
            <div className="min-h-screen grid place-items-center">
                <span className="loading loading-spinner loading-lg" />
            </div>
        );
    if (!user) return <AuthForm onLogin={loadUser} />;

    return (
        <div className="min-h-screen bg-base-200">
            <div className="navbar bg-base-100 shadow">
                <div className="flex-1">
                    <button className="btn btn-ghost text-xl" onClick={() => setView({ page: "requests" })}>
                        Helpdesk
                    </button>
                    {user.role === "admin" && (
                        <button className="btn" onClick={() => setView({ page: "admin" })}>
                            Admin Panel
                        </button>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    <Notifications onOpen={(id) => setView({ page: "request", id })} />
                    <span>{user.username}</span>
                    <span className="badge badge-outline badge-primary">{user.role}</span>
                    <button className="btn btn-sm" onClick={logout}>Log out</button>
                </div>
            </div>

            <main className="max-w-6xl mx-auto p-4">
                {view.page === "requests" && (
                    <RequestList onOpen={(id) => setView({ page: "request", id })} />
                )}
                {view.page === "request" && (
                    <RequestDetail
                        key={view.id}
                        id={view.id}
                        user={user}
                        onBack={() => setView({ page: "requests" })}
                    />
                )}
                {view.page === "admin" && <Admin currentUser={user} />}
            </main>
        </div>
    );
}
