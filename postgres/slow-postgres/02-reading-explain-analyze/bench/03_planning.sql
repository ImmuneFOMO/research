-- Run right after a restart, in a new connection: the first plan has to load the catalog, the second reuses it.
\echo '### first query in a new session'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM users WHERE id = 42;
\echo '### same query again'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM users WHERE id = 42;
\echo '### and again'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM users WHERE id = 42;
