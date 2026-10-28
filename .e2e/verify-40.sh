#!/bin/bash
# E2E Task 40 — robust: server guard di tiap langkah
cd /home/z/my-project

guard() {
  local C=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo 000)
  if [ "$C" != "200" ]; then
    nohup bun run dev > dev.log 2>&1 &
    for i in $(seq 1 60); do
      sleep 3
      C=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo 000)
      if [ "$C" = "200" ]; then break; fi
    done
  fi
}

ab() { agent-browser "$@" 2>/dev/null; }

guard
echo "SERVER_UP"

# buka dashboard fresh (hindari stale chunk)
ab open http://localhost:3000/dashboard
READY=0
for i in $(seq 1 70); do
  sleep 3
  T=$(ab eval "document.body.innerText" | tail -1)
  if echo "$T" | grep -q "Application Error"; then
    guard; ab open http://localhost:3000/dashboard; continue
  fi
  if echo "$T" | grep -q "Kalkulator Risiko"; then READY=1; break; fi
done
echo "READY=$READY"
if [ "$READY" != "1" ]; then ab eval "document.body.innerText.slice(0,400)" | tail -1; exit 1; fi

# skip onboarding
sleep 2
ab eval "var b=[...document.querySelectorAll('button')].find(x=>/lewati|skip/i.test(x.innerText)); b?(b.click(),'SKIP'):'NO'" >/dev/null
sleep 2

visit_tab() {
  local label="$1" shot="$2" pat="$3"
  guard
  local OK=$(ab eval "var b=[...document.querySelectorAll('button,a,div[role=button],[role=menuitem],li,span')].find(x=>x.innerText && x.innerText.trim().startsWith('$label') && x.offsetParent!==null); b?(b.click(),'OK'):'NOTFOUND'" | tail -1)
  echo "CLICK $label -> $OK"
  sleep 8
  guard
  ab screenshot "$shot" >/dev/null 2>&1
  local V=$(ab eval "var t=document.body.innerText; JSON.stringify({paywall:/fitur pro|upgrade ke pro|premium feature|hanya untuk pro|unlock/i.test(t), apperr:/Application Error/i.test(t), match:/$pat/i.test(t)})" | tail -1)
  echo "VERIFY $label -> $V"
}

visit_tab "Kalkulator Risiko" .e2e/40-risk.png "hitung|lot|risiko"
visit_tab "Kalender Ekonomi" .e2e/40-calendar.png "kalender|event|ekonomi"
visit_tab "Streaks" .e2e/40-streaks.png "streak|hari"
visit_tab "Pencapaian" .e2e/40-achievements.png "pencapaian|achievement|lencana"

echo "=== FINAL: dashboard utama + chart ==="
guard
ab open http://localhost:3000/dashboard
sleep 10
guard
ab screenshot .e2e/40-dashboard.png >/dev/null 2>&1
echo "DONE"
