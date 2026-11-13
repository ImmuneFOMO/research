#!/usr/bin/env python3
# Warm timings: everything prewarmed into shared_buffers, median of 7 runs per variant, variants interleaved.
# plain = psql \timing on the client; the EXPLAIN variants = the plan's Execution Time.
import json, os, re, statistics, subprocess, sys
from queries import CASES

C = sys.argv[1] if len(sys.argv) > 1 else 'pglab2'
# PSQL overrides the docker exec, e.g. PSQL='psql -h 127.0.0.1 -p 5498 -U postgres' for a native install
PSQL = os.environ.get('PSQL', '').split() or ['docker', 'exec', '-i', C, 'psql', '-U', 'postgres']
RUNS = 7
VARIANTS = {'plain': '', 'explain_analyze': 'EXPLAIN ANALYZE ', 'analyze_buffers': 'EXPLAIN (ANALYZE, BUFFERS) ',
            'timing_off': 'EXPLAIN (ANALYZE, TIMING OFF) '}

def psql(sql):
    return subprocess.run(PSQL + ['-X', '-v', 'ON_ERROR_STOP=1'],
                          input=sql, capture_output=True, text=True, check=True).stdout

psql("CREATE EXTENSION IF NOT EXISTS pg_prewarm; SELECT pg_prewarm('users'), pg_prewarm('users_pkey'), pg_prewarm('orders'), pg_prewarm('orders_user_id_idx');")
script = '\\timing on\n'
for name, (pre, q, plain) in CASES.items():
    script += f'RESET ALL; {pre}\n\\echo @@plan {name}\nEXPLAIN (ANALYZE, BUFFERS) {q};\n'
    for r in range(-2, RUNS):
        for v, prefix in VARIANTS.items():
            if v == 'plain' and not plain:
                continue
            script += f'\\echo @@run {name} {v} {r}\n{prefix}{q};\n'
out = psql(script)
OUT = os.environ.get('OUT', 'warm')
open(f'{OUT}.out', 'w').write(out)
res = {name: {'settings': pre, 'sql': q} for name, (pre, q, _) in CASES.items()}
for block in out.split('@@run ')[1:]:
    name, v, r = block.split('\n', 1)[0].split()
    if int(r) < 0:
        continue
    ex = re.findall(r'Execution Time: ([\d.]+) ms', block)
    res[name].setdefault(v, []).append(float(ex[0]) if ex else float(re.findall(r'^Time: ([\d.]+) ms', block, re.M)[0]))
for name, plan in re.findall(r'@@plan (\w+)\n(.*?)\nTime:', out, re.S):
    res[name]['plan'] = plan
for name in res:
    res[name]['median_ms'] = {v: round(statistics.median(res[name][v]), 1) for v in VARIANTS if v in res[name]}
    print(name, res[name]['median_ms'])
json.dump(res, open(f'{OUT}.json', 'w'), indent=1)
