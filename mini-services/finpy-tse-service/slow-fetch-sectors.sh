#!/bin/bash
# Slow sequential sector fetcher — one request every 25s

DB_DIR="$(cd "$(dirname "$0")/../../db" && pwd)"
PARSE_SCRIPT="$(cd "$(dirname "$0")" && pwd)/parse_b2.py"
LOG="/tmp/slow-fetch.log"

SECTORS=(
  'محصولات کاغذی:30106839080444358'
  'انتشار و چاپ:25766336681098389'
  'فرآورده های نفتی:12331083953323969'
  'لاستیک:36469751685735891'
  'فلزات اساسی:32453344048876642'
  'محصولات فلزی:1123534346391630'
  'ماشین آلات:11451389074113298'
  'دستگاه های برقی:33878047680249697'
  'وسایل ارتباطی:24733701189547084'
  'خودرو:20213770409093165'
  'قند و شکر:21948907150049163'
  'چند رشته ای:40355846462826897'
  'تامین آب، برق و گاز:54843635503648458'
  'غذایی:15508900928481581'
  'دارویی:3615666621538524'
  'شیمیایی:33626672012415176'
  'خرده فروشی:65986638607018835'
  'کاشی و سرامیک:57616105980228781'
  'سیمان:70077233737515808'
  'کانی غیر فلزی:14651627750314021'
  'سرمایه گذاری:34295935482222451'
  'بانک:72002976013856737'
  'سایر مالی:25163959460949732'
  'حمل و نقل:24187097921483699'
  'رادیویی:41867092385281437'
  'مالی:61247168213690670'
  'اداره بازارهای مالی:61985386521682984'
  'انبوه سازی:4654922806626448'
  'رایانه:8900726085939949'
  'اطلاعات و ارتباطات:18780171241610744'
  'فنی مهندسی:47233872677452574'
  'استخراج نفت:65675836323214668'
  'بیمه و بازنشستگی:59105676994811497'
)

TOTAL=${#SECTORS[@]}
DONE=0
FAIL=0
SKIP=0

echo "[$(date)] Starting slow fetch: $TOTAL sectors to check" | tee "$LOG"

for i in "${!SECTORS[@]}"; do
  ENTRY="${SECTORS[$i]}"
  SECTOR="${ENTRY%%:*}"
  WEBID="${ENTRY##*:}"
  CACHE="$DB_DIR/sec-${SECTOR}.json"

  # Skip if already cached (< 6 hours old)
  if [ -f "$CACHE" ]; then
    AGE=$(( $(date +%s) - $(stat -c %Y "$CACHE") ))
    if [ $AGE -lt 21600 ]; then
      echo "[$(date)] [$((i+1))/$TOTAL] $SECTOR: cached" | tee -a "$LOG"
      DONE=$((DONE + 1))
      continue
    fi
  fi

  echo "[$(date)] [$((i+1))/$TOTAL] Fetching $SECTOR..." | tee -a "$LOG"

  TMP="/tmp/zai_b2_${WEBID}.json"
  z-ai function -n page_reader -a "{\"url\":\"http://cdn.tsetmc.com/api/Index/GetIndexB2History/${WEBID}\"}" -o "$TMP" >/dev/null 2>&1
  if [ $? -eq 0 ] && [ -f "$TMP" ]; then
    RESULT=$(python3 "$PARSE_SCRIPT" "$TMP" "$SECTOR" "$WEBID" 2>/dev/null)
    rm -f "$TMP"

    if [[ "$RESULT" == OK:* ]]; then
      CLOSE=$(echo "$RESULT" | cut -d: -f2)
      PCP=$(echo "$RESULT" | cut -d: -f3)
      echo "[$(date)] [$((i+1))/$TOTAL] $SECTOR: $CLOSE ($PCP%)" | tee -a "$LOG"
      DONE=$((DONE + 1))
    else
      echo "[$(date)] [$((i+1))/$TOTAL] $SECTOR: $RESULT" | tee -a "$LOG"
      FAIL=$((FAIL + 1))
    fi
  else
    echo "[$(date)] [$((i+1))/$TOTAL] $SECTOR: z-ai failed" | tee -a "$LOG"
    FAIL=$((FAIL + 1))
    rm -f "$TMP"
  fi

  # 25 second delay between requests
  if [ $i -lt $((TOTAL - 1)) ]; then
    sleep 25
  fi
done

echo "[$(date)] DONE: $DONE ok, $FAIL failed, $SKIP cached" | tee -a "$LOG"
