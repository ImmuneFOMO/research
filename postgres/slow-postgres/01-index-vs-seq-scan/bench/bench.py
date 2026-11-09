#!/usr/bin/env python3
# Runs on the bench box: times seq / index / bitmap paths for each threshold on both tables.
import json, subprocess, statistics, sys

CONTAINER = sys.argv[1] if len(sys.argv) > 1 else 'pg17bench'
NS = [100, 1000, 5000, 10000, 20000, 50000, 100000, 250000, 500000]
TABLES = ['t_scattered', 't_clustered']
RUNS = 5
COMMON = "SET max_parallel_workers_per_gather = 0; SET jit = off; SET enable_indexonlyscan = off;"
PATHS = {
    'seq':    "SET enable_indexscan = off; SET enable_bitmapscan = off;",
    'index':  "SET enable_seqscan = off; SET enable_bitmapscan = off;",
    'bitmap': "SET enable_seqscan = off; SET enable_indexscan = off;",
}

def psql(sql):
    r = subprocess.run(['docker', 'exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-X', '-At', '-v', 'ON_ERROR_STOP=1'],
                       input=sql, capture_output=True, text=True, check=True)
    return r.stdout

def plans(out):
    # each EXPLAIN (FORMAT JSON) prints one JSON array, possibly over several lines
    res, buf, depth = [], '', 0
    for line in out.splitlines():
        if not buf and not line.startswith('['):
            continue
        buf += line + '\n'
        depth += line.count('[') - line.count(']')
        if depth == 0 and buf:
            res.append(json.loads(buf)[0]); buf = ''
    return res

def top_scan(p):
    while p.get('Plans') and p['Node Type'] not in ('Seq Scan', 'Index Scan', 'Bitmap Heap Scan', 'Index Only Scan'):
        p = p['Plans'][0]
    return p

psql("SELECT pg_prewarm('t_scattered'), pg_prewarm('t_clustered'), pg_prewarm('t_scattered_bucket_idx'), pg_prewarm('t_clustered_bucket_idx');")

rows = []
for t in TABLES:
    for n in NS:
        q = f"SELECT * FROM {t} WHERE bucket < {n}"
        default = plans(psql(COMMON + f"EXPLAIN (FORMAT JSON) {q};"))[0]['Plan']
        default_par = plans(psql(f"EXPLAIN (FORMAT JSON) {q};"))[0]['Plan']
        rec = {'table': t, 'n': n, 'fraction_pct': n / 10000,
               'planner_default': top_scan(default)['Node Type'],
               'planner_default_parallel_on': default_par['Node Type'] + ' > ' + top_scan(default_par)['Node Type'] if default_par['Node Type'] == 'Gather' else default_par['Node Type'],
               'paths': {}}
        for name, s in PATHS.items():
            sql = COMMON + s + f"EXPLAIN (FORMAT JSON) {q};" + "".join(
                f"EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON) {q};" for _ in range(RUNS + 1))
            ps = plans(psql(sql))
            est, runs = ps[0]['Plan'], ps[2:]  # ps[1] is the discarded warm-up
            times = [r['Execution Time'] for r in runs]
            scan = top_scan(runs[0]['Plan'])
            rec['paths'][name] = {
                'node': scan['Node Type'], 'est_cost': est['Total Cost'], 'est_rows': est['Plan Rows'],
                'actual_rows': runs[0]['Plan']['Actual Rows'],
                'shared_hit': runs[0]['Plan'].get('Shared Hit Blocks'), 'shared_read': runs[0]['Plan'].get('Shared Read Blocks'),
                'exact_heap_blocks': scan.get('Exact Heap Blocks'), 'lossy_heap_blocks': scan.get('Lossy Heap Blocks'),
                'times_ms': times, 'median_ms': statistics.median(times)}
        rows.append(rec)
        print(json.dumps(rec), flush=True)

json.dump(rows, open('results.json', 'w'), indent=1)
