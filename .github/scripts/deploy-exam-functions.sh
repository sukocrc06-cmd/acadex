#!/usr/bin/env bash
# Sınav fonksiyonlarını deploy eder (bkz. .github/workflows/deploy-exam-functions.yml).
set -euo pipefail

# Fonksiyon → "Verify JWT" ayarı (panelde 26.10.2026'da okunan değerler).
# Listede olmayan fonksiyon bu iş tarafından deploy edilmez.
declare -A VERIFY_JWT=(
  [generate-exam]=true
  [grade-exam]=true
  [extract-chart-items]=true
  [exam-appeal]=true
  [get-exam-hint]=true
)

if [ -n "${INPUT_FUNCTIONS:-}" ]; then
  targets="$INPUT_FUNCTIONS"
else
  targets=$(git diff --name-only HEAD^ HEAD -- supabase/functions | cut -d/ -f3 | sort -u | tr '\n' ' ')
fi

summary() { echo "$1" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"; }

failed=0
for fn in $targets; do
  if [ -z "${VERIFY_JWT[$fn]:-}" ]; then
    summary "- $fn: listede yok, atlandı (elle deploy)"
    continue
  fi

  # Canlı kod bir önceki main sürümüyle aynı mı (GitHub dışında değişmiş mi).
  if [ "${FORCE:-false}" != "true" ]; then
    work=$(mktemp -d)
    git show "HEAD^:supabase/functions/$fn/index.ts" > "$work/expected.ts" 2>/dev/null || : > "$work/expected.ts"
    if ! (cd "$work" && mkdir -p supabase && supabase functions download "$fn" --project-ref "$PROJECT_REF" >/dev/null 2>&1); then
      summary "- $fn: canlı kod indirilemedi; güvenlik için deploy edilmedi (elle çalıştırıp force seçin)"
      failed=1; continue
    fi
    live=$(find "$work/supabase/functions/$fn" -name index.ts | head -1 || true)
    if [ -z "$live" ] || ! python3 - "$work/expected.ts" "$live" "supabase/functions/$fn/index.ts" <<'PY'
import sys
norm = lambda p: '\n'.join(l.rstrip() for l in open(p, encoding='utf-8').read().replace('\r\n', '\n').strip().split('\n'))
live = norm(sys.argv[2])
# Canlı kod önceki main sürümüyle (ya da zaten bu sürümle) aynıysa güvenli.
sys.exit(0 if live in (norm(sys.argv[1]), norm(sys.argv[3])) else 1)
PY
    then
      summary "- $fn: canlı kod önceki main sürümünden farklı (panelden değişmiş olabilir); deploy edilmedi"
      failed=1; continue
    fi
  fi

  flag=""
  [ "${VERIFY_JWT[$fn]}" = "false" ] && flag="--no-verify-jwt"
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF" $flag
  summary "- $fn: deploy edildi ($(git rev-parse --short HEAD))"
done

exit $failed
