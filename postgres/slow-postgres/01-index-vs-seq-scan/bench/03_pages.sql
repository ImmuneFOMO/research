\pset pager off
-- for each threshold: matching rows and the number of distinct heap pages they sit on
SELECT 't_scattered' AS tbl, n, count(*) AS rows, count(DISTINCT (t.ctid::text::point)[0]) AS pages,
       (SELECT relpages FROM pg_class WHERE relname = 't_scattered') AS relpages
FROM (VALUES (100),(1000),(5000),(10000),(20000),(50000),(100000),(250000),(500000)) v(n)
JOIN t_scattered t ON bucket < n GROUP BY n ORDER BY n;
SELECT 't_clustered' AS tbl, n, count(*) AS rows, count(DISTINCT (t.ctid::text::point)[0]) AS pages,
       (SELECT relpages FROM pg_class WHERE relname = 't_clustered') AS relpages
FROM (VALUES (100),(1000),(5000),(10000),(20000),(50000),(100000),(250000),(500000)) v(n)
JOIN t_clustered t ON bucket < n GROUP BY n ORDER BY n;
