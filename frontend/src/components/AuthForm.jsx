import { useState } from "react";
import { api, setToken } from "../api";
import { ErrorAlert } from "./ui";

export default function AuthForm({ onLogin }) {
    const [mode, setMode] = useState("login");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function submit(e) {
        e.preventDefault();
        const form = new FormData(e.target);
        const username = form.get("username");
        const password = form.get("password");
        setError("");
        setLoading(true);
        try {
            if (mode === "register") await api.register(username, password);
            const { token } = await api.login(username, password);
            setToken(token);
            onLogin();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="hero min-h-screen bg-base-200">
            <form
                onSubmit={submit}
                className="card w-full max-w-sm bg-base-100 shadow-xl"
            >
                <div className="card-body">
                    <h1 className="card-title text-2xl">Helpdesk</h1>
                    <p className="text-base-content/70">
                        {mode === "login" ? "Sign in to continue" : "Create an account"}
                    </p>
                    <ErrorAlert error={error} />
                    <label className="floating-label flex flex-col">
                        <span>Username</span>
                        <input
                        name="username"
                        className="input w-full validator"
                        placeholder="Username"
                        required
                        autoComplete="username"
                        minLength={3}
                        maxLength={32}
                        pattern="[A-Za-z0-9_.\-]{3,32}"
                        />
                        <p className="hidden validator-hint">
                            Must be 3 to 32 characters
                            <br/>containing only letters, numbers or dash
                        </p>
                    </label>
                    <label className="floating-label flex flex-col">
                        <span>Password</span>
                        <input
                            name="password"
                            type="password"
                            className="input w-full validator"
                            placeholder="Password"
                            required
                            autoComplete={
                                mode === "login" ? "current-password" : "new-password"
                            }
                            minlength="8"
                        />
                        <p className="hidden validator-hint">
                            Must be at least 8 characters
                        </p>
                    </label>
                    <button className="btn btn-primary" disabled={loading}>
                        {loading && <span className="loading loading-spinner" />}
                        {mode === "login" ? "Sign in" : "Register"}
                    </button>
                    <button
                        type="button"
                        className="btn btn-link btn-sm"
                        onClick={() => setMode(mode === "login" ? "register" : "login")}
                    >
                        {mode === "login"
                            ? "No account? Register"
                            : "Have an account? Sign in"}
                    </button>
                </div>
            </form>
        </div>
    );
}
