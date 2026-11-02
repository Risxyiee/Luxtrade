#!/bin/bash
# Luxtrade TikTok promo renderer v2
# Optimasi CPU 2-core: fade in/out dipanggang per scene, concat -c copy (tanpa re-encode)
# Pemakaian: bash build-promo-video.sh [workdir]   (default: /tmp/vidgen)
set -e
WORK="${1:-/tmp/vidgen}"
cd "$WORK"
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
[ -f "$FONT" ] || FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
DUR=3.8

echo "── [1/5] Voiceover (edge-tts id-ID-ArdiNeural) ──"
gen_vo () { # $1=nomor $2=teks
  if [ ! -s "vo$1.mp3" ]; then
    edge-tts --voice id-ID-ArdiNeural --rate=+8% --text "$2" --write-media "vo$1.mp3" >/dev/null 2>&1 || true
  fi
  if [ ! -s "vo$1.mp3" ]; then
    ffmpeg -y -loglevel error -f lavfi -i anullsrc=r=24000:cl=mono -t 2 -c:a libmp3lame -q:a 9 "vo$1.mp3"
  fi
}
gen_vo 1 "Harga naik turun, kamu masih nebak-nebak sendiri?"
gen_vo 2 "Kenalin, Luxtrade. Sinyal trading otomatis, langsung ke HP kamu."
gen_vo 3 "Delapan agen AI pantau pasar dua puluh empat jam, nonstop."
gen_vo 4 "Alert masuk, kamu tinggal eksekusi. Tanpa drama."
gen_vo 5 "Luxtrade. Trading lebih tenang mulai hari ini. Cek link di bio!"

echo "── [2/5] Teks overlay ──"
printf 'MASIH\nNEBAK-NEBAK?' > t1.txt
printf 'LUXTRADE'              > t2a.txt
printf 'sinyal otomatis\nlangsung ke HP kamu' > t2b.txt
printf '8 AGEN AI'             > t3a.txt
printf 'pantau pasar 24 jam\nnonstop' > t3b.txt
printf 'TINGGAL EKSEKUSI.'     > t4.txt
printf 'LUXTRADE'              > t5a.txt
printf 'cek link di bio!'      > t5b.txt

echo "── [3/5] Render 5 scene (zoompan + fade dip-to-black) ──"
STYLE_TITLE="fontfile=$FONT:fontsize=96:fontcolor=white:borderw=7:bordercolor=black@0.9:shadowy=6:shadowcolor=black@0.5:line_spacing=12:x=(w-text_w)/2:y=h*0.20"
STYLE_GOLD="fontfile=$FONT:fontsize=116:fontcolor=0xF5C842:borderw=8:bordercolor=black@0.9:shadowy=6:shadowcolor=black@0.5:x=(w-text_w)/2:y=h*0.30"
STYLE_SUB="fontfile=$FONT:fontsize=46:fontcolor=0xE8E8F0:borderw=5:bordercolor=black@0.9:x=(w-text_w)/2:y=h*0.30+155"
STYLE_SUB5="fontfile=$FONT:fontsize=46:fontcolor=0xE8E8F0:borderw=5:bordercolor=black@0.9:x=(w-text_w)/2:y=h*0.40+175"
STYLE_GOLD5="fontfile=$FONT:fontsize=116:fontcolor=0xF5C842:borderw=8:bordercolor=black@0.9:shadowy=6:shadowcolor=black@0.5:x=(w-text_w)/2:y=h*0.40"
FADES="fade=t=in:st=0:d=0.3,fade=t=out:st=3.5:d=0.3"

render_scene () { # $1=nomor $2=filter-drawtext
  ffmpeg -y -loglevel error -i "img$1.png" \
    -vf "scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,zoompan=z='min(1+0.0023*on,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=95:fps=25:s=1080x1920,$2,$FADES" \
    -r 25 -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -an "scene$1.mp4"
  echo "   scene$1 ok"
}
render_scene 1 "drawtext=textfile=/tmp/vidgen/t1.txt:$STYLE_TITLE"
render_scene 2 "drawtext=textfile=/tmp/vidgen/t2a.txt:$STYLE_GOLD,drawtext=textfile=/tmp/vidgen/t2b.txt:$STYLE_SUB"
render_scene 3 "drawtext=textfile=/tmp/vidgen/t3a.txt:$STYLE_GOLD,drawtext=textfile=/tmp/vidgen/t3b.txt:$STYLE_SUB"
render_scene 4 "drawtext=textfile=/tmp/vidgen/t4.txt:$STYLE_TITLE"
render_scene 5 "drawtext=textfile=/tmp/vidgen/t5a.txt:$STYLE_GOLD5,drawtext=textfile=/tmp/vidgen/t5b.txt:$STYLE_SUB5"

echo "── [4/5] Concat tanpa re-encode ──"
printf "file 'scene1.mp4'\nfile 'scene2.mp4'\nfile 'scene3.mp4'\nfile 'scene4.mp4'\nfile 'scene5.mp4'\n" > list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i list.txt -c copy video_only.mp4

echo "── [5/5] Mix audio VO (mulai scene: 0 / 3.8 / 7.6 / 11.4 / 15.2) ──"
ffmpeg -y -loglevel error -i video_only.mp4 -i vo1.mp3 -i vo2.mp3 -i vo3.mp3 -i vo4.mp3 -i vo5.mp3 -filter_complex \
"[1:a]adelay=0:all=1[a1];[2:a]adelay=3800:all=1[a2];[3:a]adelay=7600:all=1[a3];[4:a]adelay=11400:all=1[a4];[5:a]adelay=15200:all=1[a5];[a1][a2][a3][a4][a5]amix=inputs=5:duration=longest:normalize=0,volume=1.7,apad,atrim=0:19,afade=t=out:st=18.2:d=0.8[aout]" \
-map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 128k -movflags +faststart out.mp4

ffprobe -v error -show_entries format=duration,size -of default=nw=1 out.mp4
echo BUILD_DONE
