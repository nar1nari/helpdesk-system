CREATE TABLE IF NOT EXISTS users (
    id                      SERIAL PRIMARY KEY,
    username                VARCHAR(50) UNIQUE NOT NULL,
    password                TEXT NOT NULL,
    role                    VARCHAR(20) NOT NULL DEFAULT 'applicant',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
    id                      SERIAL PRIMARY KEY,
    user_id                 INTEGER NOT NULL REFERENCES users(id),
    category_id             INTEGER NOT NULL REFERENCES categories(id),
    title                   VARCHAR(255) NOT NULL,
    description             TEXT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'new',
    assigned_operator_id    INTEGER REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS request_attachments (
    id                      SERIAL PRIMARY KEY,
    request_id              INTEGER NOT NULL REFERENCES requests(id),
    file_path               TEXT NOT NULL,
    original_name           VARCHAR(260) NOT NULL,
    uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS request_comments (
    id                       SERIAL PRIMARY KEY,
    request_id               INTEGER NOT NULL REFERENCES requests(id),
    author_id                INTEGER NOT NULL REFERENCES users(id),
    content                  TEXT NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);