#!/usr/bin/env bash
# Auditoría en vivo: inventario + Slither/Aderyn/Foundry/Trivy/Semgrep/Mythril.
set +e
. /etc/profile.d/cyber-tools.sh 2>/dev/null || true
export PATH="/root/.foundry/bin:/root/.cyfrin/bin:/root/.cargo/bin:/root/.local/bin:/usr/local/bin:/opt/zaproxy:/usr/bin:${PATH}"
[ -f /root/.cargo/env ] && . /root/.cargo/env
export SEMGREP_SEND_METRICS=off
MAGNO=/mnt/c/CURSORPLANTILLA-BASE/Magno
OUT=/root/cyber-scans/2026-09-16-validate
mkdir -p "$OUT"
cd "$MAGNO" || exit 1

{
  echo "===== TOOLS $(date -Is) ====="
  echo -n "node: "; node --version 2>/dev/null || echo MISSING
  echo -n "slither: "; (slither --version || python3 -m slither --version) 2>/dev/null || echo MISSING
  echo -n "aderyn: "; aderyn --version 2>/dev/null || echo MISSING
  echo -n "trivy: "; trivy --version 2>/dev/null | head -1 || echo MISSING
  echo -n "semgrep: "; (semgrep --version || python3 -m semgrep --version) 2>/dev/null || echo MISSING
  echo -n "myth: "; myth version 2>/dev/null | head -1 || echo MISSING
  echo -n "forge: "; forge --version 2>/dev/null | head -1 || echo MISSING
  echo -n "zap: "; ls /opt/zaproxy/zap.sh 2>/dev/null || echo MISSING
  echo -n "java: "; java -version 2>&1 | head -1
  df -h / /mnt/c | cat
} | tee "$OUT/tools.txt"

echo "===== 1 ADERYN $(date -Is) =====" | tee -a "$OUT/progress.txt"
aderyn "$MAGNO" \
  -s contracts \
  -x mocks,Groth16Verifier,QuatriviumCreditHarness,lib/,node_modules/,forge-out/,forge-cache/,zk-contracts/,test/,forge-test/,artifacts/,cache/ \
  -o "$OUT/aderyn-report.md"
echo ADERYN_EXIT:$? | tee -a "$OUT/progress.txt"
sed -n '1,160p' "$OUT/aderyn-report.md" 2>/dev/null | tee "$OUT/aderyn-head.txt"

echo "===== 2 FORGE $(date -Is) =====" | tee -a "$OUT/progress.txt"
forge test --fuzz-runs 256 2>&1 | tee "$OUT/forge-test.txt"
echo FORGE_TEST_EXIT:${PIPESTATUS[0]} | tee -a "$OUT/progress.txt"
forge lint 2>&1 | tee "$OUT/forge-lint.txt"
echo FORGE_LINT_EXIT:${PIPESTATUS[0]} | tee -a "$OUT/progress.txt"

echo "===== 3 SLITHER $(date -Is) =====" | tee -a "$OUT/progress.txt"
bash "$MAGNO/scripts/run-slither-wsl.sh" --json "$OUT/slither.json" 2>&1 | tee "$OUT/slither.txt"
echo SLITHER_EXIT:${PIPESTATUS[0]} | tee -a "$OUT/progress.txt"

echo "===== 4 TRIVY $(date -Is) =====" | tee -a "$OUT/progress.txt"
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
sed -n '1,180p' "$OUT/trivy.txt" | tee "$OUT/trivy-head.txt"

echo "===== 5 SEMGREP $(date -Is) =====" | tee -a "$OUT/progress.txt"
run_semgrep() {
  if command -v semgrep >/dev/null 2>&1; then
    semgrep "$@"
  else
    python3 -m semgrep "$@"
  fi
}
run_semgrep --error --quiet --metrics=off \
  --config p/solidity \
  --config p/javascript \
  --exclude node_modules --exclude android --exclude ios --exclude lib \
  --exclude forge-out --exclude forge-cache --exclude artifacts --exclude cache \
  --exclude coverage --exclude .expo \
  --json --output "$OUT/semgrep.json" \
  "$MAGNO/contracts" "$MAGNO/scripts" "$MAGNO/services" "$MAGNO/utils" \
  "$MAGNO/hooks" "$MAGNO/components" "$MAGNO/app"
echo SEMGREP_EXIT:$? | tee -a "$OUT/progress.txt"
python3 - <<'PY' || true
import json
p="/root/cyber-scans/2026-09-16-validate/semgrep.json"
try:
    data=json.load(open(p,encoding="utf-8"))
except Exception as e:
    print("semgrep json", e)
    raise SystemExit
results=data.get("results") or []
print("SEMGREP_FINDINGS", len(results))
for r in results[:50]:
    extra=r.get("extra") or {}
    print(f"- {extra.get('severity')} {r.get('check_id')} {r.get('path')}:{r.get('start',{}).get('line')} {str(extra.get('message',''))[:140]}")
PY

echo "===== 6 MYTHRIL $(date -Is) =====" | tee -a "$OUT/progress.txt"
ART="$MAGNO/artifacts/contracts/QuatriviumCredit.sol/QuatriviumCredit.json"
if [ -f "$ART" ]; then
  myth analyze "$ART" --execution-timeout 180 --max-depth 22 2>&1 | tee "$OUT/mythril-credit.txt"
  echo MYTHRIL_CREDIT_EXIT:${PIPESTATUS[0]} | tee -a "$OUT/progress.txt"
else
  echo "MYTHRIL_SKIP no artifact" | tee -a "$OUT/progress.txt"
fi
ART2="$MAGNO/artifacts/contracts/QuatriviumLeveling.sol/QuatriviumLeveling.json"
if [ -f "$ART2" ]; then
  myth analyze "$ART2" --execution-timeout 120 --max-depth 18 2>&1 | tee "$OUT/mythril-leveling.txt"
  echo MYTHRIL_LEVELING_EXIT:${PIPESTATUS[0]} | tee -a "$OUT/progress.txt"
fi

echo "===== SCANS_DONE $(date -Is) =====" | tee -a "$OUT/progress.txt"
