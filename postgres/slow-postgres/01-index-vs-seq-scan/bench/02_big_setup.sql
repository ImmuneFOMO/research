\pset pager off
\timing on
SELECT version();
SHOW shared_buffers; SHOW effective_cache_size; SHOW random_page_cost; SHOW jit; SHOW max_parallel_workers_per_gather;
CREATE EXTENSION IF NOT EXISTS pg_prewarm;
DROP TABLE IF EXISTS t_scattered, t_clustered;

-- bucket is uniform 0..999999, so "bucket < N" matches N/1,000,000 of the rows
CREATE TABLE t_scattered (
  id           bigint NOT NULL,
  bucket       int NOT NULL,
  created_at   timestamptz NOT NULL,
  amount_cents int NOT NULL,
  status       text NOT NULL
);
INSERT INTO t_scattered
SELECT i,
       floor(random() * 1000000)::int,
       now() - (5000000 - i) * interval '1 second',
       (random() * 10000)::int,
       CASE WHEN i % 10 = 0 THEN 'created' ELSE 'paid' END
FROM generate_series(1, 5000000) AS i;

-- same rows, physically sorted by bucket
CREATE TABLE t_clustered AS SELECT * FROM t_scattered ORDER BY bucket;

CREATE INDEX t_scattered_bucket_idx ON t_scattered (bucket);
CREATE INDEX t_clustered_bucket_idx ON t_clustered (bucket);
VACUUM ANALYZE t_scattered;
VACUUM ANALYZE t_clustered;

SELECT relname, relpages, reltuples::bigint, pg_size_pretty(pg_relation_size(oid)) AS size
FROM pg_class WHERE relname LIKE 't\_%' ORDER BY relname;
SELECT round(5000000.0 / relpages, 1) AS rows_per_page FROM pg_class WHERE relname = 't_scattered';
SELECT tablename, attname, correlation FROM pg_stats WHERE tablename IN ('t_scattered','t_clustered') AND attname = 'bucket';
