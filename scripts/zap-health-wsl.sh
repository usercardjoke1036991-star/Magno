#!/usr/bin/env bash
set -e
export PATH=/usr/local/bin:/usr/bin:/bin:/root/.local/bin:/opt/zaproxy
cd /mnt/c/CURSORPLANTILLA-BASE/Magno
mkdir -p /tmp/notify-zap /root/cyber-scans/2026-09-16-validate
export NOTIFY_BIND=127.0.0.1
export PORT=8788
export NOTIFY_PORT=8788
export NOTIFY_DATA_FILE=/tmp/notify-zap/.notify-data.json
export NOTIFY_DATA_KEY=zap-health-scan-key-32chars
export EXPO_PUBLIC_CHAIN_ID=97
export EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET=0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f
export NOTIFY_CORS_ORIGIN=*
node scripts/notify-worker.mjs >/tmp/notify-zap/out.log 2>&1 &
WPID=$!
echo WORKER_PID=$WPID
ok=0
for i in $(seq 1 15); do
  if curl -sf http://127.0.0.1:8788/health >/tmp/notify-zap/health.json; then
    ok=1
    break
  fi
  sleep 1
done
echo HEALTH_OK=$ok
cat /tmp/notify-zap/health.json 2>/dev/null || true
echo
/opt/zaproxy/zap.sh -cmd -quickurl http://127.0.0.1:8788/health -quickout /root/cyber-scans/2026-09-16-validate/zap-health.html -quickprogress
echo ZAP_EXIT=$?
kill $WPID 2>/dev/null || true
python3 - <<'PY'
from pathlib import Path
import re
p=Path("/root/cyber-scans/2026-09-16-validate/zap-health.html")
print("ZAP_HTML", p.exists(), p.stat().st_size if p.exists() else 0)
t=p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""
print("HIGH", len(re.findall(r"Risk: High", t, re.I)))
print("MED", len(re.findall(r"Risk: Medium", t, re.I)))
print("LOW", len(re.findall(r"Risk: Low", t, re.I)))
print("titles", re.findall(r"<title>(.*?)</title>", t)[:2])
# ZAP HTML often uses classes
for label in ["High", "Medium", "Low", "Informational"]:
    print("count", label, t.count(label))
print(t[:2000])
PY
