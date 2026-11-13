#!/usr/bin/env bash
# One command on a new box: bash overhead.sh
# Uses Docker if it works, else PostgreSQL 17 from PGBIN or PATH, else installs PostgreSQL 17 from conda-forge
# with micromamba into ~/pglab (no root needed). Extra arguments go to overhead.py (--host, --runs, --port, --keep).
set -euo pipefail
cd "$(dirname "$0")"
if [ "${MODE:-}" != native ] && docker info >/dev/null 2>&1; then
  exec python3 overhead.py --mode docker "$@"
fi
PGBIN=${PGBIN:-$(pg_config --bindir 2>/dev/null || true)}
if [ -z "$PGBIN" ] || ! "$PGBIN/postgres" --version 2>/dev/null | grep -q ' 17\.'; then
  PGLAB=${PGLAB:-$HOME/pglab}
  if [ ! -x "$PGLAB/env/bin/postgres" ]; then
    case "$(uname -s)-$(uname -m)" in
      Linux-x86_64) arch=linux-64 ;; Linux-aarch64) arch=linux-aarch64 ;; Darwin-arm64) arch=osx-arm64 ;; *) echo "unsupported platform" >&2; exit 1 ;;
    esac
    mkdir -p "$PGLAB"
    curl -fsSL "https://micro.mamba.pm/api/micromamba/$arch/latest" | tar -xj -C "$PGLAB" bin/micromamba
    "$PGLAB/bin/micromamba" create -y -q -r "$PGLAB/mamba" -p "$PGLAB/env" -c conda-forge 'postgresql=17'
  fi
  PGBIN=$PGLAB/env/bin
  set -- --source "conda-forge postgresql $("$PGBIN/postgres" --version | awk '{print $3}') via micromamba" "$@"
fi
exec python3 overhead.py --mode native --pgbin "$PGBIN" "$@"
