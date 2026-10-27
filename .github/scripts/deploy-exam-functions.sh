#!/usr/bin/env bash
# Sınav fonksiyonlarını deploy eder (bkz. .github/workflows/deploy-exam-functions.yml).
#
# Her fonksiyon için canlı kod indirilir ve Git geçmişiyle karşılaştırılır:
#   - canlı kod main'deki sürümle aynı  → güncel, atlanır
#   - canlı kod geçmişteki bir sürümle aynı → main'deki sürüm deploy edilir
#   - hiçbir sürüme uymuyor (panelden değişmiş) → deploy edilmez (force hariç)
# Böylece kaçırılmış bir deploy da sonraki çalışmada tamamlanır.
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
HISTORY_DEPTH=60

targets="${INPUT_FUNCTIONS:-}"
[ -z "$targets" ] && targets="${!VERIFY_JWT[*]}"

summary() { echo "$1" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"; }

failed=0
for fn in $targets; do
  if [ -z "${VERIFY_JWT[$fn]:-}" ]; then
    summary "- $fn: listede yok, atlandı (elle deploy)"
    continue
  fi
  src="supabase/functions/$fn/index.ts"
  [ -f "$src" ] || { summary "- $fn: depoda yok, atlandı"; continue; }

  decision="deploy"
  if [ "${FORCE:-false}" != "true" ]; then
    work=$(mktemp -d)
    mkdir -p "$work/hist"
    i=0
    for c in $(git log -n "$HISTORY_DEPTH" --format=%H -- "$src"); do
      git show "$c:$src" > "$work/hist/$i.ts" 2>/dev/null || true
      i=$((i + 1))
    done
    if ! (cd "$work" && mkdir -p supabase && supabase functions download "$fn" --project-ref "$PROJECT_REF" > "$work/download.log" 2>&1); then
      echo "--- indirme çıktısı ($fn) ---"; tail -n 20 "$work/download.log" || true
      summary "- $fn: canlı kod indirilemedi; güvenlik için deploy edilmedi"
      failed=1; continue
    fi
    echo "--- indirilen index.ts dosyaları ($fn) ---"
    find "$work/supabase" -name index.ts -printf '%s %p\n' | sed "s#$work/##" | head -n 40 || true
    decision=$(python3 - "$work" "$src" <<'PY'
import sys, glob, os
work, current = sys.argv[1], sys.argv[2]
def norm(p):
    try:
        t = open(p, encoding='utf-8', errors='replace').read()
    except OSError:
        return None
    return '\n'.join(l.rstrip() for l in t.replace('\r\n', '\n').strip().split('\n'))
live = {norm(p) for p in glob.glob(os.path.join(work, 'supabase', '**', 'index.ts'), recursive=True)}
live.discard(None)
cur = norm(current)
hist = {norm(p) for p in glob.glob(os.path.join(work, 'hist', '*.ts'))}
if cur in live:
    print('current')
elif live & hist:
    print('deploy')
else:
    print('unknown')
PY
)
  fi

  case "$decision" in
    current)
      summary "- $fn: canlı kod main ile aynı, deploy gerekmedi" ;;
    unknown)
      summary "- $fn: canlı kod Git geçmişindeki hiçbir sürüme uymuyor (panelden değişmiş olabilir); deploy edilmedi"
      failed=1 ;;
    deploy)
      flag=""
      [ "${VERIFY_JWT[$fn]}" = "false" ] && flag="--no-verify-jwt"
      supabase functions deploy "$fn" --project-ref "$PROJECT_REF" $flag
      summary "- $fn: deploy edildi ($(git rev-parse --short HEAD))" ;;
  esac
done

exit $failed
