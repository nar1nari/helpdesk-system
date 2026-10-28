import { useEffect, useState } from "react";
import { api } from "../api";
import { ErrorAlert } from "./ui";

export default function Admin({ currentUser }) {
    const [users, setUsers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [error, setError] = useState("");

    const [version, setVersion] = useState(0);

    useEffect(() => {
        Promise.all([api.users(), api.categories()])
            .then(([u, c]) => {
                setUsers(u.users);
                setCategories(c.categories);
            })
            .catch((e) => setError(e.message));
    }, [version]);

    const run = (fn) => async (...args) => {
        setError("");
        try {
            await fn(...args);
            setVersion((v) => v + 1);
        } catch (e) {
            setError(e.message);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <ErrorAlert error={error} />
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="card bg-base-100 shadow">
                    <div className="card-body">
                        <h3 className="card-title">Users</h3>
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead><tr><th>User</th><th>Role</th><th>Active</th></tr></thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.id}>
                                            <td>{u.username}</td>
                                            <td>
                                                <select
                                                    className="select select-sm"
                                                    value={u.role}
                                                    disabled={u.id === currentUser.id}
                                                    onChange={(e) => run(api.updateUser)(u.id, { role: e.target.value })}
                                                >
                                                    <option>applicant</option>
                                                    <option>operator</option>
                                                    <option>admin</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    className="toggle toggle-success"
                                                    checked={u.is_active}
                                                    disabled={u.id === currentUser.id}
                                                    onChange={(e) => run(api.updateUser)(u.id, { isActive: e.target.checked })}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <form
                            className="flex flex-wrap gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                const f = e.target;
                                run(api.createUser)({
                                    username: f.username.value,
                                    password: f.password.value,
                                    role: f.role.value,
                                }).then(() => f.reset());
                            }}
                        >
                            <input name="username" className="input input-sm w-32" placeholder="Username" required />
                            <input name="password" type="password" className="input input-sm w-32" placeholder="Password" required />
                            <select name="role" className="select select-sm w-auto">
                                <option>applicant</option>
                                <option>operator</option>
                                <option>admin</option>
                            </select>
                            <button className="btn btn-sm btn-primary">Add user</button>
                        </form>
                    </div>
                </div>

                <div className="card bg-base-100 shadow">
                    <div className="card-body">
                        <h3 className="card-title">Categories</h3>
                        <ul className="list">
                            {categories.map((c) => (
                                <li key={c.id} className="list-row items-center">
                                    <span className="list-col-grow">{c.name}</span>
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => {
                                            const name = prompt("New name", c.name);
                                            if (name) run(api.renameCategory)(c.id, name);
                                        }}
                                    >
                                        Rename
                                    </button>
                                    <button className="btn btn-sm btn-error btn-outline" onClick={() => run(api.deleteCategory)(c.id)}>
                                        Delete
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <form
                            className="join"
                            onSubmit={(e) => {
                                e.preventDefault();
                                const f = e.target;
                                run(api.addCategory)(f.name.value).then(() => f.reset());
                            }}
                        >
                            <input name="name" className="input input-sm join-item" placeholder="New category" maxLength={50} required />
                            <button className="btn btn-sm btn-primary join-item">Add</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
