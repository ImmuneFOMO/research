-- Slow Postgres part 2: one million users, five million orders.
-- Run on an empty database. Same rows on every machine: cities come from id arithmetic, the rest from setseed.
\timing on
SET max_parallel_workers_per_gather = 0;
SELECT setseed(0.42);

DROP TABLE IF EXISTS orders, users;

CREATE TABLE users (
  id         int PRIMARY KEY,
  country    text NOT NULL,
  city       text NOT NULL,
  email      text NOT NULL,
  created_at timestamptz NOT NULL
);

-- city decides country. 761 is coprime with 1000, so every block of 1,000 ids holds each slot once:
-- exactly 15,000 users in Lisbon and 20,000 in Portugal, spread evenly through the table.
INSERT INTO users
SELECT u.id, c.country, c.city, 'user' || u.id || '@example.com',
       timestamptz '2024-01-01 00:00:00+00' + u.id * interval '50 seconds'
FROM generate_series(1, 1000000) AS u(id)
JOIN (VALUES
  ('PT', 'Lisbon',          0,   15),
  ('PT', 'Porto',          15,   20),
  ('US', 'New York',       20,  140),
  ('US', 'San Francisco', 140,  220),
  ('US', 'Austin',        220,  270),
  ('GB', 'London',        270,  380),
  ('GB', 'Manchester',    380,  410),
  ('DE', 'Berlin',        410,  500),
  ('DE', 'Munich',        500,  540),
  ('FR', 'Paris',         540,  630),
  ('ES', 'Madrid',        630,  690),
  ('ES', 'Barcelona',     690,  740),
  ('BR', 'Sao Paulo',     740,  820),
  ('IN', 'Bengaluru',     820,  920),
  ('PL', 'Warsaw',        920,  960),
  ('NL', 'Amsterdam',     960, 1000)
) AS c(country, city, lo, hi)
  ON (u.id::bigint * 761) % 1000 >= c.lo AND (u.id::bigint * 761) % 1000 < c.hi;

CREATE TABLE orders (
  id           bigint PRIMARY KEY,
  user_id      int NOT NULL,
  status       text NOT NULL,
  amount_cents int NOT NULL,
  created_at   timestamptz NOT NULL
);

-- 7919 is coprime with 1,000,000: every user gets exactly 5 orders, about a million rows apart
INSERT INTO orders
SELECT g,
       1 + (g * 7919) % 1000000,
       CASE WHEN r < 0.88 THEN 'paid' WHEN r < 0.93 THEN 'refunded' WHEN r < 0.97 THEN 'failed' ELSE 'pending' END,
       (random() * 20000)::int,
       timestamptz '2026-01-01 00:00:00+00' + g * interval '6 seconds'
FROM (SELECT g, random() AS r FROM generate_series(1::bigint, 5000000) AS g) AS s;

CREATE INDEX orders_user_id_idx ON orders (user_id);

-- statistics target 10000 makes ANALYZE read every users row, so your estimates match mine exactly
ALTER TABLE users ALTER COLUMN country SET STATISTICS 10000, ALTER COLUMN city SET STATISTICS 10000;
VACUUM (ANALYZE) users, orders;

SELECT relname, relpages, reltuples::bigint, pg_size_pretty(pg_relation_size(oid)) AS size
FROM pg_class WHERE relname IN ('users', 'orders', 'users_pkey', 'orders_pkey', 'orders_user_id_idx') ORDER BY relname;
SELECT country, city, count(*) FROM users WHERE country = 'PT' GROUP BY 1, 2 ORDER BY 3 DESC;
SELECT status, count(*) FROM orders GROUP BY 1 ORDER BY 2 DESC;
