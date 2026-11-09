#!/usr/bin/env python3
# Cold-cache spot check: before every single run, restart Postgres (empties shared_buffers) and drop the OS page cache.
import json, subprocess, statistics, time

C = 'pg17bench'
COMMON = "SET max_parallel_workers_per_gather = 0; SET jit = off; SET enable_indexonlyscan = off;"
PATHS = {
    'seq':    "SET enable_indexscan = off; SET enable_bitmapscan = off;",
    'index':  "SET enable_seqscan = off; SET enable_bitmapscan = off;",
    'bitmap': "SET enable_seqscan = off; SET enable_indexscan = off;",
}
NS = [100, 1000, 5000, 10000, 20000, 50000, 100000, 250000, 500000]
CASES = [('t_scattered', n, ['seq', 'index', 'bitmap']) for n in NS] + [('t_clustered', n, ['seq', 'index']) for n in NS]
REPS = 5

def sh(cmd, inp=None):
    return subprocess.run(cmd, input=inp, capture_output=True, text=True, check=True, shell=isinstance(cmd, str)).stdout

def cold():
    sh(f'docker restart {C} >/dev/null && sync && sudo sh -c "echo 3 > /proc/sys/vm/drop_caches"')
    for _ in range(60):
        if subprocess.run(['docker', 'exec', C, 'pg_isready', '-U', 'postgres'], capture_output=True).returncode == 0:
            return
        time.sleep(0.5)

out = []
for t, n, paths in CASES:
    for p in paths:
        times, plan = [], None
        for _ in range(REPS):
            cold()
            q = f"SELECT * FROM {t} WHERE bucket < {n}"
            res = sh(['docker', 'exec', '-i', C, 'psql', '-U', 'postgres', '-X', '-At', '-q'],
                     COMMON + PATHS[p] + f"EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON) {q};")
            plan = json.loads(res)[0]
            times.append(plan['Execution Time'])
        top = plan['Plan']
        rec = {'table': t, 'n': n, 'fraction_pct': n / 10000, 'path': p, 'node': top['Node Type'],
               'shared_hit': top.get('Shared Hit Blocks'), 'shared_read': top.get('Shared Read Blocks'),
               'times_ms': times, 'median_ms': statistics.median(times)}
        out.append(rec)
        print(json.dumps(rec), flush=True)
json.dump(out, open('cold_results_full.json', 'w'), indent=1)
