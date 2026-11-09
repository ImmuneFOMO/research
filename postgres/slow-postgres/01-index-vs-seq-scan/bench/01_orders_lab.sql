\pset pager off
\echo '== version'
SELECT version();
SHOW shared_buffers; SHOW random_page_cost; SHOW seq_page_cost; SHOW cpu_tuple_cost; SHOW cpu_operator_cost; SHOW default_statistics_target; SHOW effective_cache_size;

DROP TABLE IF EXISTS orders, orders_small;
CREATE TABLE orders (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   timestamptz NOT NULL,
  amount_cents int NOT NULL,
  status       text NOT NULL
);

INSERT INTO orders (created_at, amount_cents, status)
SELECT now() - (30000 - i) * interval '1 minute',
       (random() * 10000)::int,
       CASE
         WHEN i % 1000 = 0 THEN 'chargeback'
         WHEN i % 100  = 0 THEN 'failed'
         WHEN i % 10   = 0 THEN 'created'
         ELSE 'paid'
       END
FROM generate_series(1, 30000) AS i;

CREATE INDEX orders_status_idx ON orders (status);
ANALYZE orders;
-- warm hint bits / visibility so buffer counts are stable
VACUUM orders;
ANALYZE orders;

\echo '== relpages'
SELECT relpages, reltuples FROM pg_class WHERE relname = 'orders';
\echo '== index pages'
SELECT relname, relpages FROM pg_class WHERE relname IN ('orders_status_idx','orders_pkey');
\echo '== row size / rows per page'
SELECT avg(pg_column_size(o.*))::numeric(6,1) AS avg_row_datum_bytes FROM orders o;
SELECT max(n) AS max_rows_per_page, min(n) AS min_rows_per_page FROM (SELECT (ctid::text::point)[0] AS p, count(*) n FROM orders GROUP BY 1) s;
SELECT pg_relation_size('orders') AS heap_bytes, pg_size_pretty(pg_relation_size('orders'));

\echo '== ctid sample'
SELECT ctid, id, status FROM orders WHERE status = 'chargeback' ORDER BY id LIMIT 3;

\echo '== EXPLAIN paid (default)'
EXPLAIN SELECT * FROM orders WHERE status = 'paid';
\echo '== EXPLAIN paid, enable_seqscan off'
SET enable_seqscan = off;
EXPLAIN SELECT * FROM orders WHERE status = 'paid';
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE status = 'paid';
RESET enable_seqscan;
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE status = 'paid';

\echo '== rows vs pages'
SELECT status,
       count(*)                                AS rows,
       count(DISTINCT (ctid::text::point)[0])  AS pages
FROM orders
GROUP BY status
ORDER BY rows DESC;

\echo '== failed: default plan + buffers'
EXPLAIN SELECT * FROM orders WHERE status = 'failed';
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE status = 'failed';
\echo '== failed: forced seq'
SET enable_indexscan = off; SET enable_bitmapscan = off;
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE status = 'failed';
RESET enable_indexscan; RESET enable_bitmapscan;

\echo '== chargeback: default plan + buffers'
EXPLAIN SELECT * FROM orders WHERE status = 'chargeback';
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE status = 'chargeback';
\echo '== chargeback: forced seq'
SET enable_indexscan = off; SET enable_bitmapscan = off;
EXPLAIN SELECT * FROM orders WHERE status = 'chargeback';
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE status = 'chargeback';
RESET enable_indexscan; RESET enable_bitmapscan;

\echo '== pg_stats'
SELECT null_frac, n_distinct, most_common_vals, most_common_freqs, correlation
FROM pg_stats
WHERE schemaname = 'public' AND tablename = 'orders' AND attname = 'status';

\echo '== small table'
CREATE TABLE orders_small AS SELECT * FROM orders WHERE id <= 200;
CREATE INDEX ON orders_small (status);
VACUUM ANALYZE orders_small;
SELECT relpages, reltuples FROM pg_class WHERE relname = 'orders_small';
SELECT count(*) FILTER (WHERE status='failed') AS failed_rows FROM orders_small;
EXPLAIN SELECT * FROM orders_small WHERE status = 'failed';
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders_small WHERE status = 'failed';
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders_small WHERE status = 'failed';
RESET enable_seqscan;
SET random_page_cost = 1.1;
EXPLAIN SELECT * FROM orders_small WHERE status = 'failed';
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders_small WHERE status = 'failed';
\echo '== random_page_cost 1.1 on big orders'
EXPLAIN SELECT * FROM orders WHERE status = 'failed';
EXPLAIN SELECT * FROM orders WHERE status = 'created';
EXPLAIN SELECT * FROM orders WHERE status = 'paid';
RESET random_page_cost;
\echo '== created default'
EXPLAIN SELECT * FROM orders WHERE status = 'created';

\echo '== partial index'
CREATE INDEX orders_status_not_paid_idx ON orders (status) WHERE status <> 'paid';
ANALYZE orders;
SELECT relname, relpages, reltuples FROM pg_class WHERE relname IN ('orders_status_idx','orders_status_not_paid_idx');
SELECT pg_size_pretty(pg_relation_size('orders_status_idx')) full_idx, pg_size_pretty(pg_relation_size('orders_status_not_paid_idx')) partial_idx;
DROP INDEX orders_status_idx;
EXPLAIN SELECT * FROM orders WHERE status = 'chargeback';
EXPLAIN SELECT * FROM orders WHERE status = 'paid';
PREPARE q(text) AS SELECT * FROM orders WHERE status = $1;
SET plan_cache_mode = force_generic_plan;
EXPLAIN EXECUTE q('chargeback');
RESET plan_cache_mode;
EXPLAIN EXECUTE q('chargeback');
