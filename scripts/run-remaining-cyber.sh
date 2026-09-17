#!/usr/bin/env bash
set +e
export PATH=/usr/local/bin:/usr/bin:/bin:/root/.local/bin:/root/.foundry/bin
export SEMGREP_SEND_METRICS=off
MAGNO=/mnt/c/CURSORPLANTILLA-BASE/Magno
OUT=/root/cyber-scans/2026-09-16-validate
mkdir -p "$OUT"
cd "$MAGNO" || exit 1

echo "===== SLITHER DIRECT $(date -Is) ====="
slither . --config-file slither.config.json --hardhat-ignore-compile --json "$OUT/slither.json" > "$OUT/slither-direct.txt" 2>&1
echo SLITHER_DIRECT_EXIT:$? | tee -a "$OUT/progress.txt"
tail -80 "$OUT/slither-direct.txt"

echo "===== TRIVY $(date -Is) ====="
trivy fs --skip-db-update \
  --scanners vuln,secret,misconfig \
  --skip-dirs node_modules --skip-dirs android --skip-dirs ios --skip-dirs lib \
  --skip-dirs forge-out --skip-dirs forge-cache --skip-dirs .git --skip-dirs dist --skip-dirs .expo \
  --skip-dirs artifacts --skip-dirs cache --skip-dirs coverage \
  --severity HIGH,CRITICAL,MEDIUM \
  --format table \
  --output "$OUT/trivy.txt" \
  "$MAGNO/package-lock.json" "$MAGNO/package.json" "$MAGNO/Dockerfile.notify" \
  "$MAGNO/fly.toml" "$MAGNO/render.yaml" "$MAGNO/scripts" "$MAGNO/contracts" \
  "$MAGNO/deploy"
echo TRIVY_EXIT:$? | tee -a "$OUT/progress.txt"
head -120 "$OUT/trivy.txt" | tee "$OUT/trivy-head.txt"

echo "===== SEMGREP $(date -Is) ====="
semgrep --quiet --metrics=off \
  --config p/solidity \
  --config p/javascript \
  --exclude node_modules --exclude android --exclude ios --exclude lib \
  --exclude forge-out --exclude forge-cache --exclude artifacts --exclude cache \
  --exclude coverage --exclude .expo \
  --json --output "$OUT/semgrep.json" \
  "$MAGNO/contracts" "$MAGNO/scripts" "$MAGNO/services" "$MAGNO/utils" \
  "$MAGNO/hooks" "$MAGNO/components" "$MAGNO/app"
echo SEMGREP_EXIT:$? | tee -a "$OUT/progress.txt"
python3 - <<'PY'
import json
p="/root/cyber-scans/2026-09-16-validate/semgrep.json"
data=json.load(open(p,encoding="utf-8"))
results=data.get("results") or []
print("SEMGREP_FINDINGS", len(results))
for r in results[:40]:
    extra=r.get("extra") or {}
    print(f"- {extra.get('severity')} {r.get('check_id')} {r.get('path')}:{r.get('start',{}).get('line')} {str(extra.get('message',''))[:120]}")
PY

echo "===== MYTHRIL $(date -Is) ====="
ART="$MAGNO/artifacts/contracts/QuatriviumCredit.sol/QuatriviumCredit.json"
if [ -f "$ART" ]; then
  myth analyze "$ART" --execution-timeout 180 --max-depth 22 > "$OUT/mythril-credit.txt" 2>&1
  echo MYTHRIL_CREDIT_EXIT:$? | tee -a "$OUT/progress.txt"
  tail -40 "$OUT/mythril-credit.txt"
else
  echo MYTHRIL_SKIP | tee -a "$OUT/progress.txt"
fi
ART2="$MAGNO/artifacts/contracts/QuatriviumLeveling.sol/QuatriviumLeveling.json"
if [ -f "$ART2" ]; then
  myth analyze "$ART2" --execution-timeout 120 --max-depth 18 > "$OUT/mythril-leveling.txt" 2>&1
  echo MYTHRIL_LEVELING_EXIT:$? | tee -a "$OUT/progress.txt"
  tail -20 "$OUT/mythril-leveling.txt"
fi
echo "===== SCANS_DONE $(date -Is) =====" | tee -a "$OUT/progress.txt"
