-- EXPLAIN ANALYZE executes the statement. Wrap writes in a transaction and roll it back.
SELECT count(*) AS pending_before FROM orders WHERE status = 'pending';

BEGIN;
EXPLAIN (ANALYZE, BUFFERS) DELETE FROM orders WHERE status = 'pending';
SELECT count(*) AS pending_inside_tx FROM orders WHERE status = 'pending';
ROLLBACK;

SELECT count(*) AS pending_after_rollback FROM orders WHERE status = 'pending';

-- what ROLLBACK does not undo: sequence values
CREATE TEMP TABLE audit (id bigint GENERATED ALWAYS AS IDENTITY, note text);
BEGIN;
EXPLAIN ANALYZE INSERT INTO audit (note) SELECT 'x' FROM generate_series(1, 1000);
ROLLBACK;
INSERT INTO audit (note) VALUES ('first real row') RETURNING id;
