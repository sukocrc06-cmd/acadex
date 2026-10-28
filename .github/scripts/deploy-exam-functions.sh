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
  # 28.10.2026: elle yapistirma 646 KB'de kirpiyor — bkz. workflow'daki not.
  # Bu fonksiyon tek "false": platform kapisi kapali ama yetkilendirmeyi
  # fonksiyonun KENDISI yapiyor (index.ts:8819 Authorization basligi yoksa
  # 401, 8832 sahiplik anon key + cagiranin JWT'siyle dogrulaniyor).
  # Deger panelden 28.10.2026'da okundu; true yazmak butun cagrilari kirar.
  [summarize-document]=false
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
    # Supabase kodu derlenmiş JavaScript olarak veriyor (türler atılmış,
    # biçim değişmiş); iki taraf da sözdizimi ağacı parmak iziyle karşılaştırılır.
    FP="node $(dirname "$0")/code-fingerprint.cjs"
    live_fps=$(find "$work/supabase" -name index.ts -print0 | xargs -0 -r $FP | awk '{print $1}' | grep -v -e '^hata$' -e '^okunamadi$' | sort -u || true)
    cur_fp=$($FP "$src" | awk '{print $1}')
    hist_fps=$(ls "$work/hist"/*.ts 2>/dev/null | xargs -r $FP | awk '{print $1}' | sort -u || true)
    if [ -z "$live_fps" ]; then
      decision="unknown"
    elif grep -qx "$cur_fp" <<< "$live_fps"; then
      decision="current"
    elif [ -n "$hist_fps" ] && [ -n "$(comm -12 <(echo "$live_fps") <(echo "$hist_fps"))" ]; then
      decision="deploy"
    else
      decision="unknown"
      echo "canlı parmak izi: $(echo $live_fps | cut -c1-16) · main: ${cur_fp:0:16} · geçmişte $(echo "$hist_fps" | grep -c . ) sürüm"
      livefile=$(find "$work/supabase" -name index.ts | head -1 || true)
      [ -n "$livefile" ] && $FP --explain "$livefile" "$src" "$work/hist"/*.ts || true
    fi
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
