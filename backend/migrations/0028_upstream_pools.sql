CREATE TABLE upstream_pools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    scheme TEXT NOT NULL CHECK (scheme IN ('http', 'https')),
    primary_host TEXT NOT NULL,
    primary_port INTEGER NOT NULL,
    upstream TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

ALTER TABLE proxy_hosts ADD COLUMN upstream_pool_id INTEGER
    REFERENCES upstream_pools(id) ON DELETE SET NULL;
CREATE INDEX idx_proxy_hosts_upstream_pool ON proxy_hosts(upstream_pool_id);
