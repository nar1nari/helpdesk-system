import { STATUS_BADGE } from "./format";

export const StatusBadge = ({ status }) => (
    <span className={`badge ${STATUS_BADGE[status]}`}>
        {status.replace("_", " ")}
    </span>
);

export const ErrorAlert = ({ error }) =>
    error ? (
        <div role="alert" className="alert alert-error">
            <span>{error}</span>
        </div>
    ) : null;
