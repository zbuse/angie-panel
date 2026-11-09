CREATE TABLE host_templates_user_scoped (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('http', 'stream')),
    name TEXT NOT NULL COLLATE NOCASE,
    value TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (user_id, kind, name)
);

INSERT INTO host_templates_user_scoped (id, user_id, kind, name, value, created_at, updated_at)
SELECT id, (SELECT id FROM users ORDER BY id LIMIT 1), kind, name, value, created_at, updated_at
FROM host_templates;

DROP TABLE host_templates;
ALTER TABLE host_templates_user_scoped RENAME TO host_templates;
