#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# 🎬 build-tiktok-video.sh — mesin render video TikTok 9:16 Luxtradee
# ─────────────────────────────────────────────────────────────────────
# Pakai:
#   bash scripts/build-tiktok-video.sh <spec.json> <out.mp4> [workdir]
#
# spec.json = hasil /api/cron/video-bot:
#   { "spec": { "scenes": [ { "image_prompt", "title", "sub", "vo" }, ... ] } }
#
# Pipeline (identik di lokal & GitHub Actions — ubuntu-latest):
#   1. Gambar per scene dari Pollinations (gratis, retry 3×; fallback gradient)
#   2. Voiceover Indonesia per scene via edge-tts (id-ID-ArdiNeural, gratis)
#   3. Render per scene: ken-burns zoompan + teks layar (drawtext)
#   4. Gabung scene dengan crossfade (xfade) + mix voiceover (adelay+amix)
#   5. Export H.264/AAC 1080x1920 faststart — siap posting TikTok
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

SPEC="${1:?pakai: build-tiktok-video.sh <spec.json> <out.mp4> [workdir]}"
OUT="${2:?output mp4 wajib}"
WORK="${3:-/tmp/videowork}"
mkdir -p "$WORK"
cd "$WORK"

command -v jq >/dev/null || { echo "❌ jq tidak ada"; exit 1; }
command -v ffmpeg >/dev/null || { echo "❌ ffmpeg tidak ada"; exit 1; }

FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
[ -f "$FONT" ] || FONT="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
[ -f "$FONT" ] || { echo "❌ font bold tidak ketemu"; exit 1; }

SCENE_DUR=3.8   # detik per scene
FADE=0.4        # durasi crossfade antar scene
FPS=25

# Terima dua bentuk spec: respons API (".spec.scenes") ATAU file polos (".scenes")
SCENES_PATH=$(jq -r 'if .spec.scenes then ".spec" else "" end' "$SPEC")
N=$(jq "${SCENES_PATH}.scenes | length" "$SPEC")
if [ "$N" -lt 3 ] || [ "$N" -gt 6 ]; then
  echo "❌ Jumlah scene harus 3-6, dapat: $N"
  exit 1
fi
echo "🎬 Render $N scene (${SCENE_DUR}s/scene, fade ${FADE}s)..."

# ── 1. Gambar scene (Pollinations) ──────────────────────────────────────
# Catatan: Pollinations kadang 503 rate-limit balik JSON kecil (~323 bytes) —
# file HARUS divalidasi ukurannya (≥5KB), bukan cuma ada. Backoff 15s × 5.
for ((i=0; i<N; i++)); do
  if [ -s "img$i.jpg" ] && [ "$(stat -c%s "img$i.jpg")" -ge 5000 ]; then
    echo "  ♻️ img$i sudah ada — skip"
    continue
  fi
  P=$(jq -r "${SCENES_PATH}.scenes[$i].image_prompt" "$SPEC")
  ENC=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$P")
  ok=0
  for attempt in 1 2 3 4 5; do
    curl -sL --max-time 150 -o "img$i.jpg" \
      "https://image.pollinations.ai/prompt/$ENC?width=720&height=1440&nologo=true&seed=$((42 + i * 7))" || true
    SZ=$(stat -c%s "img$i.jpg" 2>/dev/null || echo 0)
    if [ "$SZ" -ge 5000 ]; then ok=1 && break; fi
    echo "  ⏳ img$i percobaan $attempt: server sibuk ($SZ bytes) — tunggu 15s..."
    rm -f "img$i.jpg"
    sleep 15
  done
  if [ "$ok" != "1" ]; then
    echo "  ⚠️ img$i gagal semua — fallback gradient gelap"
    ffmpeg -y -loglevel error -f lavfi -i "gradients=s=720x1440:c0=0x14141E:c1=0x050508:duration=1" -frames:v 1 "img$i.jpg"
  fi
  echo "  🖼️ img$i OK ($(stat -c%s "img$i.jpg") bytes)"
done

# ── 2. Voiceover Indonesia (edge-tts) ───────────────────────────────────
python3 -c "import edge_tts" 2>/dev/null || python3 -m pip install --quiet edge-tts
for ((i=0; i<N; i++)); do
  if [ -s "vo$i.mp3" ] && [ "$(stat -c%s "vo$i.mp3")" -ge 2000 ]; then
    echo "  ♻️ vo$i sudah ada — skip"
    continue
  fi
  VO=$(jq -r "${SCENES_PATH}.scenes[$i].vo" "$SPEC")
  python3 -m edge_tts --voice id-ID-ArdiNeural --rate=+8% --text "$VO" --write-media "vo$i.mp3" >/dev/null 2>&1 || true
  if [ ! -s "vo$i.mp3" ]; then
    echo "  ⚠️ vo$i gagal — pakai hening 1.5s"
    ffmpeg -y -loglevel error -f lavfi -i anullsrc=r=24000:cl=mono -t 1.5 "vo$i.mp3"
  fi
  echo "  🎙️ vo$i OK ($(stat -c%s "vo$i.mp3") bytes)"
done

# ── 3. Teks layar → textfile (bebas masalah escaping drawtext) ──────────
for ((i=0; i<N; i++)); do
  jq -r "${SCENES_PATH}.scenes[$i].title" "$SPEC" > "t$i.txt"
  jq -r "${SCENES_PATH}.scenes[$i].sub" "$SPEC" > "s$i.txt"
done

# ── 4. Render per scene (ken-burns + teks) ──────────────────────────────
FRAMES=$(python3 -c "print(int($SCENE_DUR * $FPS))")
for ((i=0; i<N; i++)); do
  if [ -s "scene$i.mp4" ] && [ "$(stat -c%s "scene$i.mp4")" -ge 20000 ]; then
    echo "  ♻️ scene$i sudah ada — skip"
    continue
  fi
  ffmpeg -y -loglevel error -i "img$i.jpg" -vf \
"scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,zoompan=z='min(1+0.0016*on,1.20)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$FRAMES:fps=$FPS:s=1080x1920,drawtext=fontfile=$FONT:textfile=t$i.txt:fontsize=88:fontcolor=white:borderw=6:bordercolor=black@0.85:x=(w-text_w)/2:y=h*0.13,drawtext=fontfile=$FONT:textfile=s$i.txt:fontsize=44:fontcolor=0xF5C842:borderw=4:bordercolor=black@0.85:x=(w-text_w)/2:y=h*0.13+130" \
    -r "$FPS" -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -t "$SCENE_DUR" "scene$i.mp4"
  echo "  🎞️ scene$i OK"
done

# ── 5. Gabung scene dengan crossfade ────────────────────────────────────
TOTAL=$(python3 -c "print(round($N * $SCENE_DUR - ($N - 1) * $FADE, 2))")
IN=""
for ((i=0; i<N; i++)); do IN+=" -i scene$i.mp4"; done
FC=""
for ((i=1; i<N; i++)); do
  OFF=$(python3 -c "print(round($i * ($SCENE_DUR - $FADE), 2))")
  if [ "$i" -eq 1 ]; then A="[0:v]"; else A="[vx$((i-1))]"; fi
  if [ "$i" -eq "$((N-1))" ]; then OUTL="[vout]"; else OUTL="[vx$i]"; fi
  FC+="${A}[$i:v]xfade=transition=fade:duration=$FADE:offset=$OFF$OUTL;"
done
FC="${FC%;}"
# shellcheck disable=SC2086
ffmpeg -y -loglevel error $IN -filter_complex "$FC" -map "[vout]" -r "$FPS" \
  -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p "video_only.mp4"
echo "  🔗 crossfade OK (total ${TOTAL}s)"

# ── 6. Mix voiceover + export final ─────────────────────────────────────
AIN=""
for ((i=0; i<N; i++)); do AIN+=" -i vo$i.mp3"; done
FC2=""
for ((i=0; i<N; i++)); do
  DL=$(python3 -c "print(int($i * ($SCENE_DUR - $FADE) * 1000))")
  FC2+="[$((i+1)):a]adelay=${DL}[a$i];"
done
for ((i=0; i<N; i++)); do FC2+="[a$i]"; done
FADE_ST=$(python3 -c "print(round($TOTAL - 0.6, 2))")
FC2+="amix=inputs=$N:normalize=0,volume=1.5,apad,atrim=0:$TOTAL,afade=t=out:st=${FADE_ST}:d=0.6[aout]"
# shellcheck disable=SC2086
ffmpeg -y -loglevel error -i video_only.mp4 $AIN -filter_complex "$FC2" \
  -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 128k -movflags +faststart "$OUT"

SIZE=$(stat -c%s "$OUT")
if [ "$SIZE" -lt 50000 ]; then
  echo "❌ Output terlalu kecil (${SIZE} bytes) — render gagal"
  exit 1
fi
echo "✅ Video selesai: $OUT (${SIZE} bytes, ${TOTAL}s, $N scene)"
