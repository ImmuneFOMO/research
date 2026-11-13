# Machines

All runs on 2026-11-13. Same settings everywhere: `shared_buffers=1GB`, `jit=off`, `max_parallel_workers_per_gather=0` (section 8 of `02_plans.sql` turns parallel workers back on for one plan).

## instabox `offload`: the walkthrough and an overhead run

- Cloud VM (Firecracker on KVM), 4 vCPU AMD EPYC, 7.8 GiB RAM, no swap
- Debian GNU/Linux 13 (trixie), kernel 6.18.60-instabox
- Clocksource `tsc` (available: `tsc kvm-clock`). One extra overhead run with `kvm-clock`, switched at runtime and switched back: `overhead-instabox-offload-kvmclock.*`
- PostgreSQL 17.12 (Debian 17.12-1.pgdg13+1), Docker image `postgres:17`, `postgres@sha256:846a7ddaa67a4b354ae1d21087b683901aa6113a4ed626d3787cfbf6c85e3e07`, Docker 29.8.2
- Files: `01_setup.out`, `02_plans.out`, `03_planning.out`, `04_rollback.out`, `warm.*`, `cold.*`, `cold-oscache.*`, `overhead-instabox-offload*.*`

## Mac: an overhead run and the work_mem cross-check

- Apple M3 Max, 14 cores (10 performance, 4 efficiency), 36 GB RAM
- macOS 26.6.2, Darwin 25.6.0. No clocksource setting; the mach timebase runs at 24 MHz
- PostgreSQL 17.7, Homebrew `postgresql@17`, native arm64, throwaway cluster made with `initdb`, TCP on 127.0.0.1 only
- Files: `overhead-mac-m3max.*`, `warm-mac.*` (same `01_setup.sql`, loaded into a native cluster on port 5498)

## AlphaVPS, Los Angeles: an overhead run

- KVM VPS, 4 vCPU Intel Xeon Platinum 8176 @ 2.10GHz, 7.8 GiB RAM, about 2.2 GiB of it used by the services already running there
- Ubuntu 24.04.5 LTS, kernel 6.8.0-147-generic
- Clocksource `kvm-clock` (available: `kvm-clock tsc acpi_pm`)
- PostgreSQL 17.12 from conda-forge, installed with micromamba into `~/pglab` by `overhead.sh` (no root, no Docker), on 127.0.0.1:5499 only
- Live server, so the run was started with `nice -n 5`; load average was 0.25 ten minutes before the run. Cluster, data and environment were deleted afterwards
- Files: `overhead-alphavps-la.*`

## netcup: an overhead run

- KVM VPS, 6 vCPU ARM Neoverse-N1 (aarch64), 7.7 GiB RAM, about 2.7 GiB of it used by the services already running there
- Ubuntu 24.04, clocksource `arch_sys_counter` (the only one available)
- PostgreSQL 17.12 (Debian 17.12-1.pgdg13+1), Docker image `postgres:17` for arm64, run by `overhead.sh` as a non-root user in the docker group
- Live server, so the run was started with `nice -n 5`; load average was about 1.2 before the run. The container, its volume, the image and the copied scripts were deleted afterwards
- Files: `overhead-netcup-arm.*`

`bash overhead.sh --host <name>` on a new box writes `overhead-<name>.json` and `.out`.
