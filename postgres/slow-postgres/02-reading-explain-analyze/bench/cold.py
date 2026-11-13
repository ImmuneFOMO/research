#!/usr/bin/env python3
# Cold runs: before each one, restart Postgres (empties shared_buffers) and drop the OS page cache (needs sudo).
# The report query with its misestimated plan (Nested Loop) and with the city-only filter (Hash Join),
# timed three ways: plain on the client, EXPLAIN (ANALYZE, BUFFERS), and the same with TIMING OFF.
# OSCACHE=1 restarts Postgres but keeps the OS page cache: same "read" counts, served from RAM. Writes cold-oscache.*
import json, os, re, statistics, subprocess, sys, time
from queries import CASES

C = sys.argv[1] if len(sys.argv) > 1 else 'pglab2'
RUNS = 5
VARIANTS = {'plain': '', 'explain_analyze': 'EXPLAIN (ANALYZE, BUFFERS) ', 'timing_off': 'EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) '}
OSCACHE = os.environ.get('OSCACHE') == '1'
OUT = 'cold-oscache' if OSCACHE else 'cold'

def sh(cmd, inp=None):
    return subprocess.run(cmd, input=inp, capture_output=True, text=True, check=True, shell=isinstance(cmd, str)).stdout

def cold():
    sh(f'docker restart {C} >/dev/null' + ('' if OSCACHE else ' && sync && sudo sh -c "echo 3 > /proc/sys/vm/drop_caches"'))
    for _ in range(120):
        if subprocess.run(['docker', 'exec', C, 'pg_isready', '-U', 'postgres'], capture_output=True).returncode == 0:
            return
        time.sleep(0.5)

num = lambda pat, s: float((re.search(pat, s) or [0, 0])[1])
res, log = {}, ''
for name in ['report', 'report_city_only']:
    pre, q, _ = CASES[name]
    res[name] = {}
    for r in range(RUNS):
        for v, prefix in VARIANTS.items():
            cold()
            # track_io_timing adds an "I/O Timings" line: how long the plan waited on reads
            out = sh(['docker', 'exec', '-i', C, 'psql', '-U', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1'],
                     f'SET track_io_timing = on; {pre}\n\\timing on\n{prefix}{q};')
            log += f'@@cold {name} {v} {r}\n{out}\n'
            top = out.split('Planning:')[0]
            run = {'client_ms': num(r'Time: ([\d.]+) ms', out), 'execution_ms': num(r'Execution Time: ([\d.]+)', out),
                   'shared_hit': num(r'shared hit=(\d+)', top), 'shared_read': num(r' read=(\d+)', top),
                   'io_read_ms': num(r'I/O Timings: shared read=([\d.]+)', top)}
            res[name].setdefault(v, []).append(run)
            print(name, v, run, flush=True)
    res[name]['median_ms'] = {v: statistics.median(x['execution_ms'] or x['client_ms'] for x in res[name][v]) for v in VARIANTS}
    res[name]['median_io_read_ms'] = {v: statistics.median(x['io_read_ms'] for x in res[name][v]) for v in VARIANTS if v != 'plain'}
    print(name, res[name]['median_ms'], res[name]['median_io_read_ms'], flush=True)
open(f'{OUT}.out', 'w').write(log)
json.dump(res, open(f'{OUT}.json', 'w'), indent=1)
