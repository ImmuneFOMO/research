#!/usr/bin/env python3
# What EXPLAIN ANALYZE itself costs on this machine: pg_test_timing, then the same two queries
# timed plain (psql \timing), with EXPLAIN ANALYZE and with EXPLAIN (ANALYZE, TIMING OFF).
# Writes overhead-<host>.out (raw psql output) and overhead-<host>.json next to this script.
import argparse, json, os, platform, re, socket, statistics, subprocess, sys, time

p = argparse.ArgumentParser()
p.add_argument('--mode', choices=['docker', 'native'], required=True)
p.add_argument('--pgbin', help='native: directory with initdb, pg_ctl, psql, pg_test_timing')
p.add_argument('--source', default='', help='where this Postgres build came from, for the record')
p.add_argument('--image', default='postgres:17')
p.add_argument('--port', type=int, default=5499)
p.add_argument('--datadir', default=os.path.expanduser('~/pglab/overhead-data'))
p.add_argument('--host', default=socket.gethostname().split('.')[0])
p.add_argument('--runs', type=int, default=7)
p.add_argument('--keep', action='store_true', help='leave the cluster running and its data in place')
a = p.parse_args()

HERE = os.path.dirname(os.path.abspath(__file__))
NAME = 'pgoverhead'
# shared_buffers fits all three tables; parallel query and JIT off so every run does the same work on one core
SETTINGS = ['shared_buffers=1GB', 'jit=off', 'max_parallel_workers_per_gather=0']
sh = lambda cmd, **kw: subprocess.run(cmd, capture_output=True, text=True, **kw)

def start():
    if a.mode == 'docker':
        sh(['docker', 'rm', '-fv', NAME])
        subprocess.run(['docker', 'run', '-d', '--name', NAME, '--shm-size=1g', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', a.image]
                       + sum((['-c', s] for s in SETTINGS), []), check=True, capture_output=True)
        for _ in range(120):
            if 'init process complete' in sh(['docker', 'logs', NAME]).stderr + sh(['docker', 'logs', NAME]).stdout \
                    and sh(['docker', 'exec', NAME, 'pg_isready', '-U', 'postgres']).returncode == 0:
                return
            time.sleep(1)
        sys.exit('postgres container did not come up')
    if os.path.exists(a.datadir):
        sys.exit(f'{a.datadir} already exists; remove it or pass --datadir')
    os.makedirs(os.path.dirname(a.datadir), exist_ok=True)
    subprocess.run([f'{a.pgbin}/initdb', '-D', a.datadir, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C', '--no-sync'],
                   check=True, capture_output=True)
    opts = f"-p {a.port} -c listen_addresses=127.0.0.1 -c unix_socket_directories='' " + ' '.join(f'-c {s}' for s in SETTINGS)
    subprocess.run([f'{a.pgbin}/pg_ctl', '-D', a.datadir, '-l', a.datadir + '.log', '-o', opts, '-w', 'start'], check=True, capture_output=True)

def stop():
    if a.keep:
        return
    if a.mode == 'docker':
        sh(['docker', 'rm', '-fv', NAME])
    else:
        sh([f'{a.pgbin}/pg_ctl', '-D', a.datadir, '-m', 'fast', '-w', 'stop'])
        sh(['rm', '-rf', a.datadir, a.datadir + '.log'])

def psql(sql):
    cmd = (['docker', 'exec', '-i', NAME, 'psql', '-U', 'postgres'] if a.mode == 'docker'
           else [f'{a.pgbin}/psql', '-h', '127.0.0.1', '-p', str(a.port), '-U', 'postgres'])
    r = subprocess.run(cmd + ['-X', '-v', 'ON_ERROR_STOP=1'], input=sql, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stdout + r.stderr)
    return r.stdout

def test_timing():
    cmd = ['docker', 'exec', NAME, 'pg_test_timing', '-d', '3'] if a.mode == 'docker' else [f'{a.pgbin}/pg_test_timing', '-d', '3']
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout

def machine():
    m = {'os': platform.system(), 'kernel': platform.release(), 'arch': platform.machine(), 'cpus': os.cpu_count()}
    if m['os'] == 'Darwin':
        sc = lambda k: sh(['sysctl', '-n', k]).stdout.strip()
        m.update(cpu=sc('machdep.cpu.brand_string'), ram_gb=round(int(sc('hw.memsize')) / 2**30, 1),
                 os_name='macOS ' + sh(['sw_vers', '-productVersion']).stdout.strip(),
                 clocksource=f"mach timebase, {int(sc('hw.tbfrequency')) / 1e6:g} MHz")
    else:
        cs = '/sys/devices/system/clocksource/clocksource0/'
        rd = lambda f: open(f).read().strip() if os.path.exists(f) else ''
        lscpu = sh(['lscpu']).stdout
        field = lambda k: next((l.split(':', 1)[1].strip() for l in lscpu.splitlines() if l.startswith(k + ':')), '')
        mem = next(l for l in open('/proc/meminfo') if l.startswith('MemTotal'))
        m.update(cpu=field('Model name'), hypervisor=field('Hypervisor vendor'), ram_gb=round(int(mem.split()[1]) / 2**20, 1),
                 os_name=next((l.split('=', 1)[1].strip().strip('"') for l in open('/etc/os-release') if l.startswith('PRETTY_NAME')), ''),
                 clocksource=rd(cs + 'current_clocksource'), clocksources_available=rd(cs + 'available_clocksource'))
    return m

SETUP = """
DROP TABLE IF EXISTS big, outer_t, inner_t;
-- unlogged keeps the load light (no WAL); reads go through the same buffer cache as a normal table
CREATE UNLOGGED TABLE big (id int, k int);
INSERT INTO big SELECT g, g % 1000 FROM generate_series(1, 10000000) g;
CREATE UNLOGGED TABLE inner_t (id int PRIMARY KEY, v int);
INSERT INTO inner_t SELECT g, g % 97 FROM generate_series(1, 1000000) g;
-- 7919 is coprime with 1,000,000, so inner_id is a permutation: every lookup lands somewhere else
CREATE UNLOGGED TABLE outer_t (id int, inner_id int);
INSERT INTO outer_t SELECT g, 1 + (g::bigint * 7919) % 1000000 FROM generate_series(1, 1000000) g;
VACUUM (ANALYZE) big, inner_t, outer_t;
SELECT relname, relpages, reltuples::bigint FROM pg_class WHERE relname IN ('big', 'inner_t', 'outer_t', 'inner_t_pkey') ORDER BY relname;
"""
QUERIES = {
    'count': ('', 'SELECT count(*) FROM big'),
    # hash and merge joins off so the plan is a Nested Loop with one index lookup per outer row
    'nestloop': ('SET enable_hashjoin = off; SET enable_mergejoin = off;',
                 'SELECT sum(i.v) FROM outer_t o JOIN inner_t i ON i.id = o.inner_id'),
}
VARIANTS = {'plain': '', 'explain_analyze': 'EXPLAIN ANALYZE ', 'timing_off': 'EXPLAIN (ANALYZE, TIMING OFF) '}

def bench():
    script = '\\timing on\n'
    for q, (pre, sql) in QUERIES.items():
        script += f'RESET ALL; {pre}\n\\echo @@plan {q}\nEXPLAIN (ANALYZE, BUFFERS) {sql};\n'
        for r in range(-2, a.runs):  # two warm-up rounds, then the measured ones, variants interleaved
            for v, prefix in VARIANTS.items():
                script += f'\\echo @@run {q} {v} {r}\n{prefix}{sql};\n'
    out = psql(script)
    res = {q: {'sql': QUERIES[q][1], 'setup': QUERIES[q][0]} for q in QUERIES}
    for block in out.split('@@run ')[1:]:
        q, v, r = block.split('\n', 1)[0].split()
        if int(r) < 0:
            continue
        client = float(re.findall(r'^Time: ([\d.]+) ms', block, re.M)[0])
        ex = re.findall(r'Execution Time: ([\d.]+) ms', block)
        res[q].setdefault(v, []).append(float(ex[0]) if ex else client)
        res[q].setdefault(v + '_client', []).append(client)
    for q, plan in re.findall(r'@@plan (\w+)\n(.*?)\nTime:', out, re.S):
        res[q]['plan'] = plan
    for q in res:
        res[q]['median_ms'] = {v: round(statistics.median(res[q][v]), 2) for v in VARIANTS}
        res[q]['median_client_ms'] = {v: round(statistics.median(res[q][v + '_client']), 2) for v in VARIANTS}
    return out, res

start()
try:
    log = f"# overhead.py on {a.host}, {time.strftime('%Y-%m-%d %H:%M:%S %z')}, mode={a.mode}\n"
    version = psql('SELECT version();')
    log += version + psql(SETUP)
    tt = test_timing()
    log += '\n# pg_test_timing -d 3\n' + tt
    out, res = bench()
    log += '\n# bench\n' + out
    if a.mode == 'docker':
        src = a.source or 'Docker ' + sh(['docker', 'image', 'inspect', a.image, '-f', '{{index .RepoDigests 0}}']).stdout.strip()
    else:
        src = a.source or a.pgbin
    data = {
        'host': a.host, 'date': time.strftime('%Y-%m-%d'), 'mode': a.mode, 'machine': machine(),
        'postgres': {'version': re.search(r'PostgreSQL [^\n]*', version).group(0).strip(), 'source': src},
        'settings': SETTINGS + ['enable_hashjoin=off, enable_mergejoin=off for nestloop only'], 'runs': a.runs,
        'pg_test_timing': {'per_loop_ns': float(re.search(r'Per loop time including overhead: ([\d.]+) ns', tt).group(1)), 'raw': tt},
        'queries': res,
    }
    open(f'{HERE}/overhead-{a.host}.out', 'w').write(log)
    json.dump(data, open(f'{HERE}/overhead-{a.host}.json', 'w'), indent=1)
    print(json.dumps({'host': a.host, 'pg_test_timing_ns': data['pg_test_timing']['per_loop_ns'],
                      **{q: res[q]['median_ms'] for q in res}}, indent=1))
finally:
    stop()
