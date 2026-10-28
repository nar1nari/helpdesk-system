export const STATUS_BADGE = {
    new: "badge-info",
    in_progress: "badge-primary",
    pending: "badge-warning",
    resolved: "badge-success",
    closed: "badge-neutral",
    rejected: "badge-error",
};

export const fmtDate = (d) => new Date(d).toLocaleString();
