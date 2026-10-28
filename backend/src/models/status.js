const Status = Object.freeze({
    NEW: "new", // submitted by the requester; not yet picked up for processing
    IN_PROGRESS: "in_progress", // an operator has assigned themselves to the task
    PENDING: "pending", // the operator requires additional information from the requester
    RESOLVED: "resolved", // the operator considers the issue closed and is awaiting confirmation
    CLOSED: "closed", // confirmed by the requester (or auto-closed after 5 days without objection)
    REJECTED: "rejected", // the request is not accepted for processing (reason must be specified)
});
module.exports = Status;
