CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
    id                      SERIAL PRIMARY KEY,
    username                CITEXT UNIQUE NOT NULL
                            CHECK (username ~ '^[A-Za-z0-9_.-]{3,32}$'),
    password                TEXT NOT NULL,
    role                    VARCHAR(20) NOT NULL DEFAULT 'applicant'
                            CHECK (role IN ('applicant', 'operator', 'admin')),
    is_active               BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
    id                      SERIAL PRIMARY KEY,
    user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id             INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title                   VARCHAR(255) NOT NULL,
    description             TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 5000),
    status                  VARCHAR(20) NOT NULL DEFAULT 'new'
                            CHECK (status IN (
    'new','in_progress','pending','resolved','closed','rejected')),
    assigned_operator_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,
    deleted_by              INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS request_attachments (
    id                      SERIAL PRIMARY KEY,
    request_id              INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    file_path               TEXT NOT NULL,
    original_name           VARCHAR(255) NOT NULL,
    mime_type               VARCHAR(100) NOT NULL,
    size_bytes              INTEGER NOT NULL,
    uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    deleted_at              TIMESTAMPTZ,
    deleted_by              INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS request_comments (
    id                      SERIAL PRIMARY KEY,
    request_id              INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    author_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content                 TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,
    deleted_by              INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS request_status_history (
    id                      SERIAL PRIMARY KEY,
    request_id              INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    changed_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    old_status              VARCHAR(20) NOT NULL,
    new_status              VARCHAR(20) NOT NULL,
    changed_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
    id                       SERIAL PRIMARY KEY,
    user_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id               INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    actor_id                 INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type                     VARCHAR(30) NOT NULL
                             CHECK (type IN (
    'status_changed','comment_added','comment_deleted','file_added','file_deleted')),
    meta                     JSONB NOT NULL DEFAULT '{}',
    is_read                  BOOLEAN NOT NULL DEFAULT false,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
    ON notifications (user_id, is_read, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS requests_set_updated_at ON requests;
CREATE TRIGGER requests_set_updated_at
    BEFORE UPDATE ON requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();