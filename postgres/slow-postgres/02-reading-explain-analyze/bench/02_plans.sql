-- The plans the article reads, all warm: everything in shared_buffers (1 GB), JIT off, no parallel workers.
CREATE EXTENSION IF NOT EXISTS pg_prewarm;
SELECT pg_prewarm('users'), pg_prewarm('users_pkey'), pg_prewarm('orders'), pg_prewarm('orders_user_id_idx');

-- the report: orders of users in Lisbon, by status
\echo '### 1. EXPLAIN only: the forecast'
EXPLAIN
SELECT o.status, count(*) AS orders, sum(o.amount_cents) AS cents
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.country = 'PT' AND u.city = 'Lisbon'
GROUP BY o.status
ORDER BY orders DESC;

\echo '### 2. EXPLAIN (ANALYZE, BUFFERS): forecast and what happened'
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.status, count(*) AS orders, sum(o.amount_cents) AS cents
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.country = 'PT' AND u.city = 'Lisbon'
GROUP BY o.status
ORDER BY orders DESC;

\echo '### 3. where the 300 comes from'
SELECT attname, most_common_vals, most_common_freqs FROM pg_stats
WHERE tablename = 'users' AND attname IN ('country', 'city') ORDER BY attname;
SELECT 1000000 * 0.02 * 0.015 AS estimate;

\echo '### 4. the same rows without the redundant country filter'
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.status, count(*) AS orders, sum(o.amount_cents) AS cents
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.city = 'Lisbon'
GROUP BY o.status
ORDER BY orders DESC;

\echo '### 5. per-loop numbers: only failed orders'
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.amount_cents, o.created_at
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.country = 'PT' AND u.city = 'Lisbon' AND o.status = 'failed';

\echo '### 6. the report again with work_mem = 64MB'
SET work_mem = '64MB';
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.status, count(*) AS orders, sum(o.amount_cents) AS cents
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.country = 'PT' AND u.city = 'Lisbon'
GROUP BY o.status
ORDER BY orders DESC;
RESET work_mem;

\echo '### 7. Hash and Sort spilling at the default work_mem (4MB), then at 64MB'
EXPLAIN (ANALYZE, BUFFERS)
SELECT u.email, o.amount_cents
FROM orders o JOIN users u ON u.id = o.user_id
WHERE o.status = 'failed'
ORDER BY o.amount_cents DESC;
SET work_mem = '64MB';
EXPLAIN (ANALYZE, BUFFERS)
SELECT u.email, o.amount_cents
FROM orders o JOIN users u ON u.id = o.user_id
WHERE o.status = 'failed'
ORDER BY o.amount_cents DESC;
RESET work_mem;

\echo '### 8. parallel workers on: loops counts the leader and each worker'
SET max_parallel_workers_per_gather = 2;
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.status, count(*) AS orders, sum(o.amount_cents) AS cents
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.city = 'Lisbon'
GROUP BY o.status
ORDER BY orders DESC;
RESET max_parallel_workers_per_gather;
