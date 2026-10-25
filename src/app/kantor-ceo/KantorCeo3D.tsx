// @ts-nocheck
'use client'
// ============================================================
// KantorCeo3D — LUXTRADE SUPER AI AGENT (CEO Dashboard 3D)
// UI 3D (kantor virtual: CTO/CSO/CMO/CFO + CEO) + panel kontrol API.
// Scene Three.js ditanam langsung di file ini — lazy import di dalam
// useEffect, jadi TIDAK ADA three.js yang dimuat saat SSR/prerender.
// (Dimuat via next/dynamic ssr:false dari page.tsx.)
// Adaptasi Luxtradee: notifikasi Discord (bukan WA), field notifySent/
// notifyErr, domain luxtradee.web.id, tabel bug_reports.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { getClientBrowserAsync } from '@/lib/supabase-browser'

const CSS = `
.kg{background:rgba(255,255,255,.92);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);border:1px solid rgba(15,23,42,.08);border-radius:16px;box-shadow:0 8px 28px rgba(30,41,59,.12)}
#kclock{position:absolute;top:16px;left:16px;padding:12px 16px;min-width:190px;color:#1f2437;font-family:system-ui,sans-serif}
#ktime{font-size:34px;font-weight:700;letter-spacing:1px;font-variant-numeric:tabular-nums;color:#0f172a}
#kphase{font-size:13px;color:#0d9488;margin-bottom:8px}
#kbar{height:4px;border-radius:4px;background:rgba(15,23,42,.1);margin-bottom:10px}
#kbar i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#8b5cf6,#10b981)}
.kbtn{font:inherit;font-size:12px;padding:5px 10px;border-radius:8px;border:1px solid rgba(15,23,42,.14);background:#fff;color:#1f2437;cursor:pointer;margin:0 4px 4px 0}
.kbtn.on{background:#d9f5ea;border-color:#10b981;color:#065f46}
.kchip{font:inherit;font-size:11.5px;padding:5px 9px;border-radius:999px;border:1px solid rgba(15,23,42,.13);background:#fff;color:#334155;cursor:pointer}
.kchip.on{background:#0f766e;border-color:#0f766e;color:#fff}
#khint{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);padding:8px 16px;font-size:12px;color:#1f2437;opacity:.9;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
#ktip{position:absolute;left:0;top:0;width:220px;padding:11px 14px;font-size:13px;line-height:1.4;color:#1f2437;pointer-events:none;opacity:0;transition:opacity .25s;will-change:transform}
#ktip b{display:flex;justify-content:space-between;margin-bottom:5px}#ktip b span{color:#0d9488;font-weight:500}
.kbb{position:absolute;left:0;top:0;pointer-events:none;padding:5px 9px;font-size:11px;line-height:1.3;border-radius:12px;max-width:190px;background:rgba(255,255,255,.92);border:1px solid rgba(15,23,42,.1);box-shadow:0 4px 14px rgba(30,41,59,.14);transform-origin:50% 100%;will-change:transform;color:#1f2437;font-family:system-ui,sans-serif}.kbb b{display:block;color:#0d9488}.kbb i{font-style:normal;opacity:.8;display:block}
#ktoast{position:absolute;left:50%;bottom:70px;transform:translateX(-50%) translateY(10px);padding:10px 20px;font-size:13px;color:#0f172a;opacity:0;transition:.4s;pointer-events:none;white-space:nowrap}
#ktoast.show{opacity:1;transform:translateX(-50%)}
`

export default function KantorCeo3D() {
  const mountRef = useRef(null)
  const runBriefingRef = useRef(null)
  const focusRef = useRef(null)
  const pickRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [sceneErr, setSceneErr] = useState('')
  const [gate, setGate] = useState<'checking' | 'ok' | 'denied'>('checking')
  const [token, setToken] = useState('')
  const [sbKey, setSbKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState(null)
  const [room, setRoom] = useState('overview')
  const [acc, setAcc] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [clock, setClock] = useState('')
  /* Bahan analisis TikTok (Ruang CMO) */
  const [tt, setTt] = useState<any[]>([])
  const [ttUrl, setTtUrl] = useState('')
  const [ttViews, setTtViews] = useState('')
  const [ttLikes, setTtLikes] = useState('')
  const [ttMsg, setTtMsg] = useState('')
  const [ttBusy, setTtBusy] = useState(false)
  /* ---- JEMBATAN data real → scene 3D ----
     liveRef = mirror state `data` supaya loop 3D bisa baca hasil agen ASLI.
     busyRef = agen yang SEDANG dikerjakan beneran (API call in-flight).
     doneRef = timestamp agen terakhir selesai → karakter "rayakan" hasil nyata. */
  const liveRef = useRef<any>(null)
  const busyRef = useRef<Record<string, number>>({})
  const doneRef = useRef<Record<string, number>>({})

  /* ---------- jam WIB (panel) ---------- */
  useEffect(() => {
    const f = () => setClock(new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()))
    f(); const iv = setInterval(f, 1000); return () => clearInterval(iv)
  }, [])

  /* mirror data → scene 3D (tiap kali hasil agen masuk) */
  useEffect(() => { liveRef.current = data }, [data])

  /* ---------- email-gate: cuma owner (luxtradee@gmail.com) yang boleh masuk.
     Tidak perlu tempel secret apa pun — pakai sesi login situs yang sudah ada. */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sb = await getClientBrowserAsync()
        if (!sb) { if (!cancelled) setGate('denied'); return }
        const { data: sdata } = await sb.auth.getSession()
        const email = (sdata?.session?.user?.email || '').toLowerCase().trim()
        if (cancelled) return
        if (email === 'luxtradee@gmail.com') {
          setToken(sdata.session.access_token)
          try {
            const { loadSupabaseConfig } = await import('@/lib/supabase/config-loader')
            const cfg = await loadSupabaseConfig()
            if (!cancelled && cfg.anonKey) setSbKey(cfg.anonKey)
          } catch { /* anon key opsional — env bisa jalan tanpa ini */ }
          setGate('ok')
        } else {
          setGate('denied')
        }
      } catch { if (!cancelled) setGate('denied') }
    })()
    return () => { cancelled = true }
  }, [])

  /* ---------- pemanggil API (hasil di-merge supaya tiap ruangan punya datanya) ---------- */
  /* Map action → karakter mana yang "beneran kerja" di scene 3D */
  const jobsOfAction = (action: string): string[] => {
    const M: Record<string, string> = { cto: 'CTO', cso: 'CSO', cmo: 'CMO', cfo: 'CFO' }
    if (action.startsWith('agents&only=')) return (action.split('only=')[1] || '').split(',').map(s => M[s.trim()]).filter(Boolean)
    if (action === 'agents') return ['CTO', 'CSO', 'CFO']
    if (action === 'briefing') return ['CTO', 'CSO', 'CMO', 'CFO', 'CEO']
    if (action === 'quota') return ['CFO']
    if (action === 'acc-email' || action === 'auto-acc') return ['CSO']
    if (action.startsWith('tiktok-')) return ['CMO']
    if (action === 'diag' || action === 'watchdog') return ['CTO']
    if (action === 'weekly') return ['CEO']
    if (action === 'discord-test' || action === 'briefing-last') return ['CEO']
    return []
  }
  const call = useCallback(async (action: string, method = 'GET') => {
    /* tandai karakter sedang KERJA BENERAN (balon pikiran + animasi ikut nyambung) */
    const jobs = jobsOfAction(action)
    jobs.forEach(j => { busyRef.current[j] = Date.now() })
    setBusy(true); let r: any
    try {
      const res = await fetch(`/api/ceo-agent?action=${action}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(sbKey ? { 'X-SB-Key': sbKey } : {}),
        },
      })
      r = await res.json()
    } catch (e) { r = { error: String(e) } } finally {
      setBusy(false)
      jobs.forEach(j => { delete busyRef.current[j]; doneRef.current[j] = Date.now() })
    }
    if (action === 'acc-email') { // ditangani khusus di Ruang CSO
      window.__kceo?.toast?.(r?.dup ? '📧 ACC EMAIL sudah dicatat hari ini' : r?.ok ? '📧 ACC EMAIL dicatat — CSO tuntas!' : '⚠️ ACC EMAIL gagal — cek Ruang CSO')
      return r
    }
    if (action === 'quota') r = { cfo: r }          // respons flat → bungkus jadi data CFO
    if (action === 'briefing' && r?.text)
      window.__kceo?.toast?.(r.notifySent ? '🌅 Briefing terkirim ke Discord! ✅' : '⚠️ Briefing jalan — Discord gagal kirim')
    setData((d: any) => ({ ...(d || {}), ...r }))
    return r
  }, [token, sbKey])

  useEffect(() => { runBriefingRef.current = () => call('briefing', 'POST') }, [call])
  useEffect(() => { pickRef.current = (r: string) => setRoom(r) }, [])
  // Kantor dibuka: muat CTO/CSO/CFO + status AUTO-ACC — draf TikTok CMO hanya saat diminta (hemat kuota Gemini)
  useEffect(() => { if (gate === 'ok') { call('agents&only=cto,cso,cfo'); call('auto-acc') } // eslint-disable-line react-hooks/exhaustive-deps
  }, [gate])
  useEffect(() => { focusRef.current && focusRef.current(room) }, [room])

  /* ---------- Bahan analisis TikTok (dipakai CMO tiap bikin draf) ---------- */
  const ttH = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(sbKey ? { 'X-SB-Key': sbKey } : {}) }
  const ttLoad = useCallback(async () => {
    try {
      const res = await fetch('/api/ceo-agent?action=tiktok-list', { headers: ttH })
      const r = await res.json()
      setTt(r?.posts || [])
      if (r?.error) setTtMsg('⚠️ ' + r.error)
    } catch (e) { setTtMsg('⚠️ ' + String(e)) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sbKey])
  const ttAdd = async () => {
    if (!ttUrl.trim() || ttBusy) return
    setTtBusy(true); setTtMsg('')
    try {
      const res = await fetch('/api/ceo-agent?action=tiktok-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...ttH },
        body: JSON.stringify({ url: ttUrl.trim(), views: Number(ttViews) || 0, likes: Number(ttLikes) || 0 }),
      })
      const r = await res.json()
      if (r?.error) setTtMsg('⚠️ ' + r.error)
      else {
        setTtMsg(r?.captionAuto ? '✅ Tersimpan — caption diambil otomatis dari TikTok' : '✅ Tersimpan')
        setTtUrl(''); setTtViews(''); setTtLikes('')
        window.__kceo?.toast?.('📚 CMO dapat bahan analisis baru!')
        await ttLoad()
      }
    } catch (e) { setTtMsg('⚠️ ' + String(e)) } finally { setTtBusy(false) }
  }
  const ttDel = async (id: string) => {
    setTtBusy(true)
    try {
      await fetch(`/api/ceo-agent?action=tiktok-del&id=${encodeURIComponent(id)}`, { method: 'POST', headers: ttH })
      setTt((l) => l.filter((p) => p.id !== id))
    } catch { /* ignore */ } finally { setTtBusy(false) }
  }
  // Ruang CMO dibuka → muat daftar bahan
  useEffect(() => { if (room === 'CMO') ttLoad() /* eslint-disable-line react-hooks/exhaustive-deps */
  }, [room])

  /* ============================================================
     SCENE 3D — dimuat penuh di client (tanpa SSR)
     ============================================================ */
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let cleanup = () => {}

    ;(async () => {
      const THREE = await import('three')
      const OC = await import('three/examples/jsm/controls/OrbitControls.js')
      const OrbitControls = OC.OrbitControls
      if (disposed) return

      const EM='#10f5a0',PU='#7c3aed',PI=Math.PI
      const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),rnd=(a,b)=>a+Math.random()*(b-a)
      const dm=(a,b,l,dt)=>a+(b-a)*(1-Math.exp(-l*dt))
      const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),dma=(a,b,l,dt)=>a+wrap(b-a)*(1-Math.exp(-l*dt))

      /* ---------- DOM UI (hidup di dalam mount, dibersihkan saat unmount) ---------- */
      const styleEl=document.createElement('style');styleEl.textContent=CSS;mount.appendChild(styleEl)
      const bubEl=document.createElement('div');bubEl.style.cssText='position:absolute;inset:0;overflow:hidden;pointer-events:none';mount.appendChild(bubEl)
      const hud=document.createElement('div')
      hud.innerHTML=`<div id="kclock" class="kg"><div id="ktime">09:00</div><div id="kphase">Jam kerja</div><div id="kbar"><i id="kfill"></i></div>
        <button id="klive" class="kbtn on">WIB Langsung</button><button data-s="6" class="kbtn">Cepat 1×</button><button data-s="18" class="kbtn">Cepat 3×</button><button id="kskip" class="kbtn">Lompat 10:55</button></div>
        <div id="khint" class="kg">Geser = putar · scroll = zoom · klik karyawan = buka ruangannya · klik laptop CEO = briefing beneran</div>
        <div id="ktoast" class="kg"></div>
        <div id="ktip" class="kg"><b>—<span></span></b><div></div></div>`
      mount.appendChild(hud)
      const $t=s=>hud.querySelector(s)
      const toastEl=$t('#ktoast');let toastTO
      const showToast=msg=>{toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(toastTO);toastTO=setTimeout(()=>toastEl.classList.remove('show'),4200)}

      /* ---------- tim = 4 agen + CEO ---------- */
      const CAST=[
        {name:'Raka',job:'CTO',title:'CTO Agent · IT & QA',lazy:.25,shirt:'#0e7490',skin:'#c68642',hair:'#111',desk:[-11,-6.5],room:'back',accent:'#14b8a6'},
        {name:'Sinta',job:'CMO',title:'CMO Agent · Copywriter',lazy:.6,shirt:'#7c3aed',skin:'#e0ac69',hair:'#2b1b12',desk:[-2.75,-6.5],room:'back',accent:'#8b5cf6'},
        {name:'Maya',job:'CSO',title:'CSO Agent · Customer Success',lazy:.5,shirt:'#be185d',skin:'#f1c27d',hair:'#1a1a1a',desk:[-11,3],room:'front',accent:'#ec4899'},
        {name:'Putri',job:'CFO',title:'CFO Agent · Quota Manager',lazy:.35,shirt:'#b45309',skin:'#f1c27d',hair:'#3b2314',desk:[-2.75,3],room:'front',accent:'#f59e0b'},
        {name:'Alexander',job:'CEO',title:'CEO & Founder',lazy:.1,ceo:true,shirt:'#0b0b12',skin:'#c68642',hair:'#1a1a1a',desk:[6,-6.5],room:'ceo',accent:'#334155'}]
      const PHASES=['Cek Sistem & Bug','Hitung User','Draf TikTok','Cek Kuota','Kirim Briefing']
      const PHASE_JOB=['CTO','CSO','CMO','CFO','CEO']
      const PHASE_TASK={'CTO':'Ping luxtradee.web.id & hitung bug 24 jam','CSO':'Hitung pendaftar, aktif & pasif','CMO':'Generate draf TikTok di Gemini','CFO':'Pantau kuota Gemini anti-429','CEO':'Review & kirim Morning Briefing'}
      const CHLOG=['Ping 200 OK & bug dihitung','Segmentasi user selesai','Draf TikTok baru siap','Kuota aman — 0 event 429','Briefing terkirim ke Discord']
      const SITE={ver:1.0,vis:41,day:1247}
      const PROJ={ph:0,prog:35,sprint:1,done:0}
      const projTot=()=>(PROJ.ph+PROJ.prog/100)/5*100
      const INC={active:false,next:60+rnd(0,60),endT:0,boostT:0}

      const SPOTS=[{p:[9.2,2.6],y:0,sit:1},{p:[10.8,2.6],y:0,sit:1},{p:[9.2,5.4],y:PI,sit:1},{p:[10.8,5.4],y:PI,sit:1},{p:[12,2.7],y:PI/2,sit:0}]
      const OBST=[];CAST.forEach(c=>OBST.push({x:c.desk[0],z:c.desk[1],hw:c.ceo?1.3:.9,hd:.45}))
      OBST.push({x:10,z:2.6,hw:1.2,hd:.5},{x:10,z:5.4,hw:1.2,hd:.5},{x:10,z:4,hw:.6,hd:.3},{x:13.7,z:4,hw:.4,hd:1.7},{x:15.2,z:1,hw:.2,hd:.2},{x:-13.5,z:-4.5,hw:.6,hd:.3},{x:-9,z:6,hw:1.5,hd:.7},{x:7.6,z:-4,hw:.3,hd:.3},{x:-7.6,z:-6,hw:.3,hd:.3},{x:7.6,z:9,hw:.3,hd:.3},{x:-3,z:10,hw:.3,hd:.3})
      // dinding kamar (segmen dengan celah pintu di depan tiap meja) — jalan kaki otomatis lewat pintu
      const wseg=(x1,x2,z)=>OBST.push({x:(x1+x2)/2,z,hw:(x2-x1)/2,hd:.14})
      const wsegV=(x,z1,z2)=>OBST.push({x,z:(z1+z2)/2,hw:.14,hd:(z2-z1)/2})
      ;[[-15.5,-11.8],[-10.2,-3.55],[-1.95,1]].forEach(s=>{wseg(s[0],s[1],-2.5);wseg(s[0],s[1],-.5);wseg(s[0],s[1],6.5)})
      wsegV(-6.5,-10,-2.5);wsegV(-6.5,-.5,6.5);wsegV(1,-10,-2.5);wsegV(1,-.5,6.5)
      const POSE={deep:{tp:.08,hp:.2,ra:[-.6,.08,-1],la:[-.6,.08,-1]},phone:{tp:-.28,hp:.62,ra:[-.7,.05,-1.5],la:[-.7,.05,-1.5]},
        stretch:{tp:-.2,hp:-.25,ra:[-2.9,.3,-.2],la:[-2.9,.3,-.2]},scratch:{tp:0,hp:-.05,ra:[-.7,.05,-1.5],la:[-2.3,.45,-1.9]},
        chat:{tp:0,hp:0,ra:[-.3,.1,-.7],la:[-.2,.1,-.4]},drink:{tp:-.05,hp:-.1,ra:[-1.8,.1,-1.9],la:[-.2,.1,-.4]},think:{tp:.05,hp:.08,ra:[-.7,.05,-1.5],la:[-1.1,.25,-2.2]},stand:{tp:0,hp:0,ra:[0,.08,-.08],la:[0,.08,-.08]}}
      const T2={
        CTO:{deep:['Ping luxtradee.web.id — harap 200 OK','Hitung bug 24 jam dari bug_reports','Cek latency situs & uptime'],phone:['Baca changelog dependency'],chat:['Review bug_reports sama QA']},
        CSO:{deep:['Hitung total pendaftar dari Supabase','Segmentasi user aktif vs pasif','Susun daftar user pasif buat email'],phone:['Scroll daftar user baru'],chat:['Diskusi email sapaan bareng CEO']},
        CMO:{deep:['Generate draf TikTok via Gemini','Analisis gaya naskah CEO yang fyp','Rotasi angle: SMC/ICT hari ini'],phone:['Scroll TikTok cari referensi'],chat:['Nego deadline konten sama CSO']},
        CFO:{deep:['Pantau kuota Gemini Vision harian','Cek frekuensi upload — hindari 429','Hitung sisa request hari ini'],phone:['Lihat grafik pemakaian API'],chat:['Set quota-track ke backend']},
        CEO:{deep:['Baca Morning Briefing 08:00','Review draf TikTok dari CMO','Pantau performa 4 agen'],phone:['Cek harga saham. Lagi.'],chat:['Sinkron roadmap mingguan']}}
      const GEN2={stretch:'Regangan sebentar, pegal…',scratch:'Hmm, kenapa ya?',think:'Mikir solusi…',drink:'Seruput kopi dulu ☕'}
      let tNow=0
      /* ---- STATUS NYATA dari API (bukan panggung) ----
         Kalau data live ada, karakter lapor hasil kerja ASLI, bukan kalimat tempelan. */
      const realStatus=job=>{
        const live=liveRef.current
        if(!live)return null
        try{
          if(job==='CTO'&&live.cto&&!live.cto.error&&!live.cto.err)
            return live.cto.siteOk
              ? `📊 LIVE: web ${live.cto.status} OK (${live.cto.latencyMs} ms) · bug 24j: ${live.cto.bugs24h>=0?live.cto.bugs24h:'?'}`
              : '📊 LIVE: web lagi DOWN — aku pantau terus'
          if(job==='CSO'&&live.cso&&!live.cso.error)
            return `📊 LIVE: ${live.cso.total} pendaftar · ${live.cso.active} aktif · ${live.cso.passive} pasif`
          if(job==='CMO'&&live.cmo)
            return live.cmo.draft?'📊 LIVE: draf TikTok hari ini sudah siap ✅':null
          if(job==='CFO'&&live.cfo&&!live.cfo.error)
            return `📊 LIVE: kuota ${live.cfo.usedToday}/${live.cfo.limit} hari ini · ${String(live.cfo.status||'').trim()}`
          if(job==='CEO'&&live.text)
            return live.notifySent?'📊 LIVE: briefing terakhir sudah terkirim ✅':'📊 LIVE: briefing siap — tinggal kirim'
        }catch{ }
        return null}
      const thought2=(c,S)=>{
        /* PRIORITAS 1 — sedang KERJA BENERAN (API call in-flight)? */
        if(busyRef.current[c.job]){
          const W={CTO:'⏳ Lagi ping situs & hitung bug — kerja beneran, bukan main-main!',
            CSO:'⏳ Lagi hitung user dari database Supabase — kerja beneran!',
            CMO:'⏳ Lagi nulis draf TikTok di Gemini — kerja beneran!',
            CFO:'⏳ Lagi audit kuota API — kerja beneran!',
            CEO:'⏳ Lagi susun briefing & kirim ke Discord…'}
          return W[c.job]||'⏳ Lagi kerja beneran…'}
        /* PRIORITAS 2 — baru selesai (≤9 dtk): rayakan dgn HASIL ASLI */
        const D=doneRef.current
        if(D[c.job]&&Date.now()-D[c.job]<9000){
          const live=liveRef.current
          const R: any={
            CTO:()=>live&&live.cto&&!live.cto.error&&!live.cto.err?`✅ Beres! Web ${live.cto.siteOk?live.cto.status+' OK · '+live.cto.latencyMs+' ms':'DOWN'} · bug ${live.cto.bugs24h>=0?live.cto.bugs24h:'?'}`:'✅ Tugas selesai!',
            CSO:()=>live&&live.cso&&!live.cso.error?`✅ Beres! ${live.cso.total} pendaftar · ${live.cso.active} aktif · ${live.cso.passive} pasif`:'✅ Tugas selesai!',
            CMO:()=>live&&live.cmo?(live.cmo.draft?'✅ Draf TikTok baru siap — cek panel kanan!':'⚠️ Gagal bikin draf — cek panel'):'✅ Tugas selesai!',
            CFO:()=>live&&live.cfo&&!live.cfo.error?`✅ Kuota ${live.cfo.usedToday}/${live.cfo.limit} · ${String(live.cfo.status||'').trim()}`:'✅ Tugas selesai!',
            CEO:()=>live&&live.text?(live.notifySent?'✅ Briefing terkirim ke Discord!':'⚠️ Briefing jalan — Discord gagal'):'✅ Tugas selesai!'}
          return (R[c.job]||(()=>'✅ Tugas selesai!'))()}
        if(INC.active){if(c.job==='CEO')return 'Mendengar laporan insiden dari CTO…'
          if(c.job==='CTO')return S.stage==='report'?'Bug di live site! Lapor CEO dulu 🐞':'Cari akar masalah bug checkout'
          if(c.job==='CSO')return 'Semoga cepat beres, user komplain nih'
          return 'Tim hotfix, aku fokus kerjaanku'}
        if(INC.boostT>tNow){if(c.job==='CTO')return 'Hotfix jalan — deploy sebentar lagi 🔧'
          if(c.job==='CSO')return 'Siapkan email sapaan kalau di-ACC'
          return 'Tim lagi hotfix, aku fokus kerjaanku'}
        if(S.leaving)return 'Beres-beres, mau pulang 👋'
        if(S.arriving)return 'Selamat pagi! Baru sampai ☀️'
        if(S.stage==='rising')return S.goal?'Waktunya istirahat! Geser kursi':'Istirahat selesai…'
        if(S.stage==='walking')return S.goal?'Jalan ke pantry':'Kembali ke meja'
        if(S.stage==='lounge')return S.sub==='chat'?'Ngobrol sambil ngopi ☕':S.coffee?'Ngopi dulu ☕':'Istirahat sejenak ☕'
        if(S.stage==='sitting')return 'Duduk lagi…'
        if(S.stage==='seated'&&S.sub==='deep'){
          if(c.job===PHASE_JOB[PROJ.ph])return PHASE_TASK[c.job]+' · '+Math.round(PROJ.prog)+'%'
          /* tampilkan status NYATA kalau ada (bukti agen kerja beneran),
             selingi kalimat flavor biar hidup */
          const real=realStatus(c.job)
          if(real&&Math.floor(tNow/7+c.i)%3!==2)return real
          const a=T2[c.job].deep;return a[Math.floor(tNow/7+c.i)%a.length]}
        if(S.stage==='seated'&&C.min>=840&&S.sub!=='chat')return 'Briefing besok tinggal review 😌'
        const a=T2[c.job][S.sub]||GEN2[S.sub];return Array.isArray(a)?a[Math.floor(tNow/8+c.i)%a.length]:a}

      /* ---------- renderer / scene ---------- */
      const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))
      renderer.setSize(mount.clientWidth||innerWidth,mount.clientHeight||innerHeight)
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap
      renderer.outputColorSpace=THREE.SRGBColorSpace
      renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.25
      mount.appendChild(renderer.domElement)
      const scene=new THREE.Scene();scene.background=new THREE.Color('#dfe7f2');scene.fog=new THREE.Fog('#dfe7f2',45,110)
      const camera=new THREE.PerspectiveCamera(42,(mount.clientWidth||innerWidth)/(mount.clientHeight||innerHeight),.1,100)
      camera.position.set(2,9,17)
      const controls=new OrbitControls(camera,renderer.domElement)
      Object.assign(controls,{enableDamping:true,dampingFactor:.06,maxPolarAngle:PI/2.1,minDistance:4,maxDistance:32});controls.target.set(2,.8,0)

      /* ---------- fokus kamera per ruangan ---------- */
      const FOCUS={on:false,pos:new THREE.Vector3(),tgt:new THREE.Vector3()}
      const ROOMV={overview:[[2,9,17],[2,.8,0]],CTO:[[-11,4.6,-.8],[-11,.9,-7]],CMO:[[-2.75,4.6,-.8],[-2.75,.9,-7]],CSO:[[-11,4.6,8],[-11,.9,2]],CFO:[[-2.75,4.6,8],[-2.75,.9,2]],rapat:[[6,3.2,1.8],[6,1.1,-6.5]]}
      const focusRoom=r=>{const P=ROOMV[r];if(!P){FOCUS.on=false;return}
        FOCUS.pos.set(...P[0]);FOCUS.tgt.set(...P[1]);FOCUS.on=true}
      focusRef.current=focusRoom
      controls.addEventListener('start',()=>{FOCUS.on=false})
      // hook debug (dipakai QA otomatis; ringan, tak berpengaruh ke UI)
      // + toast() → React side bisa kirim notifikasi ke scene (hasil kerja beneran)
      window.__kceo={focus:focusRoom,toast:showToast,cam:()=>camera.position.toArray().map(v=>Math.round(v*10)/10),tgt:()=>controls.target.toArray().map(v=>Math.round(v*10)/10),focusing:()=>FOCUS.on}

      const M=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:.7,...o})
      const glow=(c,i=3)=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:i})
      const box=(w,h,v,m,x,y,z,p=scene,cast=true)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,v),m);o.position.set(x,y,z);o.castShadow=cast;o.receiveShadow=true;p.add(o);return o}
      const cyl=(r,h,m,x,y,z,p,seg=12)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),m);o.position.set(x,y,z);o.castShadow=true;p.add(o);return o}
      const sph=(r,m,x,y,z,p)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,16,14),m);o.position.set(x,y,z);o.castShadow=true;p.add(o);return o}

      /* ---------- pencahayaan ikut waktu (TERANG — siang putih terang, malam tetap nyaman) ---------- */
      const amb=new THREE.AmbientLight(0xffffff,1.0);scene.add(amb)
      const sun=new THREE.DirectionalLight(0xffffff,1.15);sun.position.set(6,14,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048)
      Object.assign(sun.shadow.camera,{left:-20,right:20,top:14,bottom:-14,far:50});scene.add(sun)
      const spot=(c,i,p,t)=>{const s=new THREE.SpotLight(c,i,0,.75,1);s.position.set(...p);s.target.position.set(...t);s.castShadow=true;s.shadow.mapSize.set(1024,1024);scene.add(s,s.target);return s}
      const sp1=spot(PU,1.9,[-5,10,0],[-2,0,0]),sp2=spot(EM,1.6,[10,9,4],[10,0,4])
      const accL=new THREE.PointLight(EM,1.2,18);accL.position.set(1.5,3,-8.4);scene.add(accL)
      const pl2=new THREE.PointLight(PU,.9,18);pl2.position.set(6,2.5,-5);scene.add(pl2)
      const ceilGlows=[]
      const cSunD=new THREE.Color('#fff3e0'),cSunN=new THREE.Color('#b8b0e0'),cAmbD=new THREE.Color('#e3e8f5'),cAmbN=new THREE.Color('#a8a0d5'),cBgD=new THREE.Color('#dfe7f2'),cBgN=new THREE.Color('#2d3250'),cT=new THREE.Color()
      const dayFactor=m=>m<300?0:m<420?(m-300)/120:m<870?1:m<1020?1-(m-870)/150:0
      let dayF=null
      const lightTick=dt=>{
        const d=dayFactor(C.min);if(dayF===null)dayF=d;dayF=dm(dayF,d,.6,dt)
        sun.intensity=.22+1.05*dayF;cT.copy(cSunD).lerp(cSunN,1-dayF);sun.color.copy(cT)
        amb.intensity=.55+.45*dayF;cT.copy(cAmbD).lerp(cAmbN,1-dayF);amb.color.copy(cT)
        sp1.intensity=1.9*(.4+.6*dayF);sp2.intensity=1.6*(.4+.6*dayF)
        ceilGlows.forEach(m=>m.emissiveIntensity=.3+.85*dayF)
        cT.copy(cBgD).lerp(cBgN,1-dayF);scene.background.copy(cT);scene.fog.color.copy(cT)}

      /* ---------- lantai, dinding, neon ---------- */
      const floor=new THREE.Mesh(new THREE.PlaneGeometry(34,24),M('#d9dde6',{roughness:.5,metalness:.04}));floor.rotation.x=-PI/2;floor.position.x=1.5;floor.receiveShadow=true;scene.add(floor)
      box(24,5,.1,new THREE.MeshStandardMaterial({color:'#f1f5fb',transparent:true,opacity:.5,roughness:.25}),1.5,2.5,-10,scene,false)
      for(const y of[0,5])box(24,.08,.12,glow(PU),1.5,y,-9.95,scene,false)
      const neon=(txt,w,h,font,x,y,z,ry=0,col=EM)=>{
        const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*h/w);const g=c.getContext('2d')
        g.font=`800 ${font}px system-ui,sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillStyle=col;g.shadowColor=col
        for(const b of[20,8]){g.shadowBlur=b;g.fillText(txt,512,c.height/2)}
        g.shadowBlur=0;g.lineWidth=8;g.strokeStyle='#03140d';g.strokeText(txt,512,c.height/2);g.fillStyle=col;g.fillText(txt,512,c.height/2)
        const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace
        const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,fog:false}));m.position.set(x,y,z);m.rotation.y=ry;scene.add(m);return m}
      box(12.6,3.5,.04,M('#04050a',{roughness:.4}),1.5,3.75,-9.94,scene,false);neon('KANTOR LUXTRADE',12,3,92,1.5,3.75,-9.9);neon('PANTRY',4,1,110,10.8,3.2,7.1,PI)

      /* ---------- pantry ---------- */
      const rug=new THREE.Mesh(new THREE.PlaneGeometry(6.5,6.5),M('#f0e6d8',{roughness:.9}));rug.rotation.x=-PI/2;rug.position.set(10.8,.01,4);rug.receiveShadow=true;scene.add(rug)
      for(const[z,r]of[[2.6,0],[5.4,PI]]){const s=new THREE.Group();s.position.set(10,0,z);s.rotation.y=r;scene.add(s)
        box(2.4,.44,1,M('#e3b27a'),0,.22,0,s);box(2.4,.5,.2,M('#cf9c60'),0,.65,-.4,s);for(const x of[-1.1,1.1])box(.2,.5,1,M('#cf9c60'),x,.4,0,s)}
      box(1.2,.44,.6,M('#e8eaf0',{metalness:.4,roughness:.35}),10,.22,4);box(.8,1,3.4,M('#c9b08e',{roughness:.5}),13.7,.5,4);box(.4,.3,.4,glow(EM,2.2),13.7,1.15,4)

      /* ---------- arsitektur ---------- */
      const tileTex=(w,h,fn,rx,ry)=>{const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'));const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
      const flat=(x,z,w,d,y,m)=>{const o=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m);o.rotation.x=-PI/2;o.position.set(x,y,z);o.receiveShadow=true;scene.add(o)}
      flat(-3.55,1,23.9,22,.003,M('#fff',{roughness:.95,map:tileTex(128,128,g=>{g.fillStyle='#d7dbe4';g.fillRect(0,0,128,128);for(let i=0;i<500;i++){g.fillStyle=`rgba(148,158,178,${rnd(.06,.12)})`;g.fillRect(rnd(0,128),rnd(0,128),2,2)}},12,11)}))
      flat(13.45,1,10.1,22,.004,M('#fff',{roughness:.25,metalness:.2,map:tileTex(128,128,g=>{g.fillStyle='#cfc6ba';g.fillRect(0,0,128,128);g.strokeStyle='#b3a894';g.lineWidth=3;g.strokeRect(0,0,128,128)},10,22)}))
      flat(13.45,3.9,10.1,8.2,.006,M('#fff',{roughness:.5,map:tileTex(128,128,g=>{for(let y=0;y<128;y+=16){g.fillStyle=`hsl(26,${rnd(40,50)}%,${rnd(58,66)}%)`;g.fillRect(0,y,128,15);g.fillStyle='#a17c50';g.fillRect(0,y+15,128,1)}},5,4)}))
      const wallM=M('#edeaf3',{roughness:.9}),glassW=new THREE.MeshStandardMaterial({color:'#8ab4ff',transparent:true,opacity:.2,roughness:.05,metalness:.3})
      const wallL=new THREE.Group(),wallR=new THREE.Group(),wallF=new THREE.Group(),ceil=new THREE.Group();scene.add(wallL,wallR,wallF,ceil)
      for(const[g,x]of[[wallL,-15.55],[wallR,18.55]]){box(.2,.9,24,wallM,x,.45,0,g);box(.2,.5,24,wallM,x,4.75,0,g);box(.05,3.6,24,glassW,x,2.7,0,g,false)
        for(let z=-12;z<=12;z+=4)box(.14,3.6,.14,M('#c9ccd8',{metalness:.6}),x,2.7,z,g)}
      box(34,5,.2,wallM,1.5,2.5,12.1,wallF);box(34,.12,.05,glow(PU,1.5),1.5,.1,11.95,wallF,false)
      box(5,5,.2,wallM,-13,2.5,-10);box(5,5,.2,wallM,16,2.5,-10)
      ;[[7.6,-4],[-7.6,-6],[7.6,9],[-3,10]].forEach(([x,z])=>box(.5,4.8,.5,M('#e4e2ec',{roughness:.7}),x,2.4,z))
      box(.04,2.2,1.5,glassW,18.4,1.1,.8,scene,false);box(.5,.18,.04,glow('#22c55e',1.6),18.3,2.5,.8,scene,false)
      const cp=new THREE.Mesh(new THREE.PlaneGeometry(34,24),M('#fff',{roughness:.9,map:tileTex(64,64,g=>{g.fillStyle='#f3f4f8';g.fillRect(0,0,64,64);g.strokeStyle='#dcdee8';g.lineWidth=3;g.strokeRect(0,0,64,64)},17,12)}));cp.rotation.x=PI/2;cp.position.set(1.5,4.8,0);ceil.add(cp)
      for(const z of[-6,0,6])for(const x of[-9,-3,3,9,15]){const m=glow('#eaf2ff',.9);ceilGlows.push(m);box(2.4,.06,.5,m,x,4.74,z,ceil,false)}
      for(const x of[-9,3,15])box(.5,.3,24,M('#d5d8e2'),x,4.62,0,ceil,false)
      const plant=(x,z)=>{cyl(.3,.5,M('#1a1030'),x,.25,z,scene);for(let i=0;i<5;i++)sph(rnd(.22,.34),M('#0f6b3d'),x+rnd(-.2,.2),rnd(.7,1.2),z+rnd(-.2,.2),scene)}
      ;[[-12,-8],[12,-8],[-12,9],[15,8],[3,-6],[-12,1]].forEach(p=>plant(...p))
      box(34,.03,.1,glow(PU,2),1.5,.02,11.9,scene,false);box(.1,.03,24,glow(PU,2),-15.5,.02,0,scene,false);box(.1,.03,24,glow(EM,2),18.5,.02,0,scene,false)

      /* ---------- 4 KAMAR KACA — tiap tugas punya ruangan sendiri ---------- */
      const partH=(x1,x2,z)=>{const w=x2-x1,cx=(x1+x2)/2,g=new THREE.Group();scene.add(g)
        box(w,.95,.12,M('#dcd9e6'),cx,.475,z,g,false);box(w,1.6,.05,glassW,cx,1.75,z,g,false)
        box(w,.07,.14,M('#c8c5d4'),cx,2.58,z,g,false);return g}
      const partV=(x,z1,z2)=>{const dd=z2-z1,cz=(z1+z2)/2,g=new THREE.Group();scene.add(g)
        box(.12,.95,dd,M('#dcd9e6'),x,.475,cz,g,false);box(.05,1.6,dd,glassW,x,1.75,cz,g,false)
        box(.14,.07,dd,M('#c8c5d4'),x,2.58,cz,g,false);return g}
      const jamb=(x,z)=>{box(.14,2.6,.18,M('#aab2c0'),x,1.3,z,scene,false);sph(.07,glow('#10b981',2),x,2.72,z,scene,false)}
      ;[[-15.5,-11.8],[-10.2,-3.55],[-1.95,1]].forEach(s=>{partH(s[0],s[1],-2.5);partH(s[0],s[1],-.5);partH(s[0],s[1],6.5)})
      ;[[-11.8,-10.2],[-3.55,-1.95]].forEach(gp=>{jamb(gp[0],-2.5);jamb(gp[1],-2.5);jamb(gp[0],6.5);jamb(gp[1],6.5)})
      partV(-6.5,-10,-2.5);partV(-6.5,-.5,6.5);partV(1,-10,-2.5);partV(1,-.5,6.5)
      const roomAcc=(x,z,col,rugC)=>{const r=new THREE.Mesh(new THREE.PlaneGeometry(4.8,4.6),M(rugC,{roughness:.9}));r.rotation.x=-PI/2;r.position.set(x,.008,z);r.receiveShadow=true;scene.add(r)
        const l=new THREE.PointLight(col,.65,9);l.position.set(x,2.3,z);scene.add(l)}
      roomAcc(-11,-6.2,'#14b8a6','#d8f2ea');roomAcc(-2.75,-6.2,'#8b5cf6','#ebe3fa')
      roomAcc(-11,3,'#ec4899','#fae1ee');roomAcc(-2.75,3,'#f59e0b','#fbf0d9')
      neon('RUANG CTO',3.3,.8,46,-11,1.95,-9.86,0,'#0d9488')
      neon('RUANG CMO',3.3,.8,46,-2.75,1.95,-9.86,0,'#7c3aed')
      neon('RUANG CSO',3.3,.8,46,-11,1.95,-.42,0,'#db2777')
      neon('RUANG CFO',3.3,.8,46,-2.75,1.95,-.42,0,'#d97706')
      neon('CEO SUITE',2.5,.6,40,6,1.5,-9.9,0,'#7c3aed')

      /* ---------- infrastruktur ---------- */
      const rackLeds=[]
      for(let r=0;r<3;r++){const x=14.2+r*1.1;box(.9,2.1,.9,M('#0b0b12',{metalness:.5,roughness:.4}),x,1.05,-9.2)
        for(let k=0;k<7;k++){box(.8,.05,.02,M('#15151f'),x,.35+k*.27,-8.74,scene,false);for(let j=0;j<3;j++){const m=glow(j?EM:'#38bdf8',2);rackLeds.push(m);box(.04,.04,.02,m,x-.3+j*.1+(k%2)*.3,.37+k*.27,-8.73,scene,false)}}}
      box(1.2,.7,.6,M('#d6d3de'),-13.5,.35,-4.5);box(.7,.35,.5,M('#e5e7eb',{roughness:.5}),-13.5,.88,-4.5)
      box(.4,1,.4,M('#94a3b8'),15.2,.5,1);cyl(.17,.45,glow('#38bdf8',1.2),15.2,1.25,1,scene)
      box(.08,2.4,1.6,glow(PU,1.2),18.45,1.2,.8,scene,false)
      for(const x of[17.5,-14]){sph(.12,M('#111'),x,4.5,-9.8,scene);sph(.03,glow('#ef4444',3),x,4.42,-9.68,scene)}

      /* ---------- papan KPI + jam dinding + layar LIVE + laptop CEO ---------- */
      const bc=document.createElement('canvas');bc.width=1024;bc.height=512;const bg=bc.getContext('2d'),bt=new THREE.CanvasTexture(bc);bt.colorSpace=THREE.SRGBColorSpace
      const board=new THREE.Mesh(new THREE.PlaneGeometry(4,2),new THREE.MeshStandardMaterial({color:0,map:bt,emissiveMap:bt,emissive:0xffffff,emissiveIntensity:1.3}));board.position.set(14.9,3.35,-9.88);scene.add(board)
      box(4.2,2.2,.1,M('#0a0a0f'),14.9,3.35,-9.94,scene,false)
      let gold=2342.5,gh=Array(40).fill(2342.5),bT=0
      let lapC,lapG,lapTex
      const drawLap=()=>{if(!lapG)return;const g=lapG;g.fillStyle='#03130d';g.fillRect(0,0,256,160)
        g.strokeStyle='#0b3b2a';g.lineWidth=1;for(let i=1;i<8;i++){g.beginPath();g.moveTo(0,i*20);g.lineTo(256,i*20);g.stroke()}
        g.strokeStyle=EM;g.lineWidth=2.5;g.beginPath();gh.forEach((v,i)=>{const x=8+i*(240/39),y=140-(v-2300)/100*110;i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke()
        g.fillStyle=EM;g.font='bold 15px monospace';g.fillText('XAUUSD  '+gold.toFixed(2),8,16)
        g.fillStyle=INC.active?'#ef4444':'#9fb3ad';g.font='11px monospace';g.fillText(INC.active?'⚠ INSIDEN — HOTFIX':'LUXTRADE · LIVE',8,150);lapTex.needsUpdate=true}
      const pc=document.createElement('canvas');pc.width=512;pc.height=340;const pg=pc.getContext('2d'),pt2=new THREE.CanvasTexture(pc);pt2.colorSpace=THREE.SRGBColorSpace
      box(3.7,2.5,.06,M('#0a0a0f'),10.8,2.2,-9.92,scene,false)
      const projScr=new THREE.Mesh(new THREE.PlaneGeometry(3.5,2.34),new THREE.MeshBasicMaterial({map:pt2}));projScr.position.set(10.8,2.2,-9.88);scene.add(projScr)
      const drawSite=()=>{const g=pg,tot=(PROJ.ph+PROJ.prog/100)/5
        g.fillStyle='#0b0f16';g.fillRect(0,0,512,340)
        g.fillStyle='#161d29';g.fillRect(0,0,512,32)
        ;['#ef4444','#f59e0b','#22c55e'].forEach((c,i)=>{g.fillStyle=c;g.beginPath();g.arc(16+i*20,16,5,0,7);g.fill()})
        g.fillStyle='#0b0f16';g.fillRect(90,6,320,20);g.fillStyle='#5eead4';g.font='11px monospace';g.fillText('https://luxtradee.web.id',104,20)
        const pulse=.6+.4*Math.sin(tNow*4)
        g.fillStyle=`rgba(16,245,160,${.15+pulse*.2})`;g.fillRect(430,6,72,20)
        g.fillStyle='#10f5a0';g.beginPath();g.arc(441,16,4,0,7);g.fill();g.font='bold 11px monospace';g.fillText('LIVE',450,20)
        if(INC.active){g.fillStyle='rgba(239,68,68,.9)';g.fillRect(0,32,512,22);g.fillStyle='#fff';g.font='bold 11px monospace';g.fillText('⚠ INSIDEN LIVE: bug checkout — hotfix jalan',18,47)}
        g.fillStyle='#e8fff6';g.font='bold 15px system-ui';g.fillText('LUXTRADE',20,64)
        g.fillStyle='rgba(255,255,255,.4)';g.font='12px system-ui';g.fillText('Produk   Harga   Blog   Tentang',330,64)
        g.fillStyle='#9fb3ad';g.font='11px monospace';g.fillText('v'+SITE.ver.toFixed(1),440,64)
        g.fillStyle='#f5d06f';g.font='bold 28px system-ui';g.fillText('Trade Gold,',20,104);g.fillText('Tanpa Ribet.',20,134)
        g.fillStyle='rgba(255,255,255,.5)';g.fillRect(20,150,190,6);g.fillRect(20,164,140,6)
        g.strokeStyle='#10f5a0';g.lineWidth=2;g.beginPath();let y=95;for(let x=0;x<=32;x++){y=clamp(y+Math.sin(x*.7)*8+(x%3-1)*4,64,160);const px=290+x*6;x?g.lineTo(px,y):g.moveTo(px,y)}g.stroke()
        g.fillStyle='rgba(16,245,160,.9)';g.font='bold 11px monospace';g.fillText('● '+Math.round(SITE.vis)+' ONLINE',290,178)
        g.fillStyle='#10151f';[16,178,340].forEach(x=>g.fillRect(x,186,156,76))
        g.fillStyle='rgba(16,245,160,.6)';[32,194,356].forEach(x=>g.fillRect(x,200,26,26))
        g.fillStyle='rgba(255,255,255,.25)';[68,230,392].forEach(x=>g.fillRect(x,206,88,7));[68,230,392].forEach(x=>g.fillRect(x,222,110,6))
        g.fillStyle='rgba(255,255,255,.18)';g.fillRect(16,270,470,6);g.fillRect(16,282,360,6)
        g.fillStyle='#0b3b2a';g.fillRect(20,294,472,8);g.fillStyle='#10f5a0';g.fillRect(20,294,472*tot,8)
        g.fillStyle='#9fb3ad';g.font='12px monospace';g.fillText('AGENT #'+PROJ.sprint+' · '+PHASES[PROJ.ph]+' · '+Math.round(tot*100)+'%',20,322)
        pt2.needsUpdate=true}
      const drawBoard2=dt=>{bT-=dt;if(bT>0)return;bT=.5;gold=clamp(gold+rnd(-1.6,1.6),2300,2400);gh.push(gold);gh.shift()
        const tgt=38+PROJ.done*2+(C.brk?-9:0)+(INC.active?-14:0)+Math.sin(C.min/230)*7
        SITE.vis+=(tgt-SITE.vis)*.06+rnd(-1.1,1.1);SITE.vis=clamp(SITE.vis,3,240)
        SITE.day=Math.max(0,SITE.day+rnd(.2,.9)+(INC.active?-1:0))
        const g=bg,m=C.min,st=INC.active?'⚠ Insiden live — hotfix':(m<420||m>=960?'Di luar jam kerja':C.brk?'Istirahat siang':m>=840?'Santai':'Jam kerja'),tot=projTot()
        g.fillStyle='#04120c';g.fillRect(0,0,1024,512);g.fillStyle='#0a2a1d';g.fillRect(0,0,1024,84)
        g.fillStyle='#10f5a0';g.font='bold 40px system-ui,sans-serif';g.fillText('PAPAN KINERJA KANTOR LUXTRADE',32,56)
        g.fillStyle='#9fb3ad';g.font='32px system-ui,sans-serif';g.fillText('Harga Emas (XAUUSD)',32,140)
        g.fillStyle='#fff';g.font='bold 84px system-ui,sans-serif';g.fillText(gold.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})+' USD',32,224)
        g.font='30px system-ui,sans-serif';g.fillStyle='#e8fff6'
        g.fillText('Jam: '+fmt(m)+' WIB',32,290);g.fillText('Status: '+st,32,336);g.fillText('Online: '+Math.round(SITE.vis)+' · Hari ini: '+Math.round(SITE.day),32,382)
        g.fillStyle='#10f5a0';g.fillText('SUPER AI AGENT · SPRINT #'+PROJ.sprint,520,290)
        g.fillStyle='#e8fff6';g.fillText(PHASES[PROJ.ph]+' · '+Math.round(tot*100)+'%',520,336)
        g.fillStyle='#0b3b2a';g.fillRect(520,400,470,14);g.fillStyle='#10f5a0';g.fillRect(520,400,470*tot/100,14)
        g.strokeStyle='#10f5a0';g.lineWidth=4;g.beginPath();gh.forEach((v,i)=>{const x=32+i*24,y=500-(v-2300)/100*70;i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke();bt.needsUpdate=true
        drawLap();drawSite()}
      const wc=document.createElement('canvas');wc.width=256;wc.height=128;const wg=wc.getContext('2d'),wt=new THREE.CanvasTexture(wc);wt.colorSpace=THREE.SRGBColorSpace
      const wallClk=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.9),new THREE.MeshBasicMaterial({map:wt,color:0xcccccc}));wallClk.position.set(7.9,1.42,-9.88);scene.add(wallClk)
      const drawWall=()=>{const g=wg,s=Math.floor((C.min%1)*60);g.fillStyle='#07100c';g.fillRect(0,0,256,128);g.fillStyle='#e8fff6';g.font='bold 54px monospace';g.textAlign='center';g.fillText(fmt(C.min)+':'+String(s).padStart(2,'0'),128,68);g.fillStyle='#10f5a0';g.font='20px monospace';g.fillText('WIB (UTC+7)',128,104);wt.needsUpdate=true}

      /* ---------- monitor hidup ---------- */
      const makeLive=()=>{const c=document.createElement('canvas');c.width=256;c.height=160;const g=c.getContext('2d')
        const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace
        return{g,tex,pr:2380+rnd(0,40),h:Array(40).fill(2380)}}
      const drawLive=S=>{const g=S.g;S.pr=clamp(S.pr+rnd(-3.5,3.2),2300,2450);S.h.push(S.pr);S.h.shift()
        g.fillStyle='#03130d';g.fillRect(0,0,256,160);g.strokeStyle='#0b3b2a';g.lineWidth=1
        for(let i=1;i<8;i++){g.beginPath();g.moveTo(0,i*20);g.lineTo(256,i*20);g.stroke()}
        g.strokeStyle=EM;g.lineWidth=2.5;g.beginPath();S.h.forEach((v,i)=>{const x=8+i*6,y=140-(v-2300)/150*115;i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke()
        g.fillStyle=EM;g.font='bold 13px monospace';g.fillText('XAUUSD '+S.pr.toFixed(2),8,16);S.tex.needsUpdate=true}
      const liveTex=[makeLive(),makeLive(),makeLive()];liveTex.forEach(drawLive)
      let ltI=0,ltT=0
      const liveTick=dt=>{ltT-=dt;if(ltT>0)return;ltT=1.2;drawLive(liveTex[ltI++%3])}
      let scrK=0
      const screenMat=()=>{const t=liveTex[scrK++%3].tex;return new THREE.MeshStandardMaterial({color:0,map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:1.7})}

      /* ---------- manusia + meja ---------- */
      const G=()=>new THREE.Group(),at=(p,o,x=0,y=0,z=0)=>{o.position.set(x,y,z);p.add(o);return o}
      const limb=(l1,l2,r,c1,c2,foot)=>{const a=G(),b=G();b.position.y=-l1;a.add(b)
        cyl(r,l1,M(c1),0,-l1/2,0,a,10);sph(r,M(c1),0,-l1,0,a);cyl(r*.9,l2,M(c2),0,-l2/2,0,b,10);sph(r*.9,M(c2),0,-l2,0,b)
        if(foot)box(.1,.06,.22,M('#0b0b0f'),0,-l2,.05,b);return{a,b}}

      const E=[],pick=[]
      let laptop
      CAST.forEach((cfg,i)=>{
        cfg.i=i
        const d=cfg.desk,seatZ=d[1]+.66,w=cfg.ceo?2.6:1.8
        box(w,.05,.9,M('#b98a5e',{roughness:.55}),d[0],.76,d[1])
        for(const k of[-1,1])box(.05,.74,.8,M('#8a6f56'),d[0]+k*(w/2-.05),.38,d[1])
        box(w,.02,.02,glow(PU),d[0],.755,d[1]+.45,scene,false);box(.45,.02,.15,M('#0a0a0f'),d[0],.79,d[1]+.22)
        cyl(.04,.1,M(Math.random()<.5?'#e5e7eb':'#7c3aed'),d[0]+rnd(.55,.8)*(Math.random()<.5?1:-1),.84,d[1]+rnd(-.1,.2),scene)
        box(.2,.015,.28,M('#d1d5db'),d[0]+rnd(-.8,-.5),.79,d[1]+rnd(-.05,.2),scene)
        const mats=[]
        if(!cfg.ceo)[-.45,.45].forEach(x=>{const g=at(scene,G(),d[0]+x,.78,d[1]-.2);g.rotation.y=-x*.3
          box(.05,.24,.04,M('#222'),0,.12,-.03,g);box(.8,.46,.03,M('#08080c'),0,.45,0,g)
          const m=screenMat(),s=new THREE.Mesh(new THREE.PlaneGeometry(.75,.41),m);s.position.set(0,.45,.017);g.add(s);mats.push(m)})
        else{laptop=at(scene,G(),d[0],.78,d[1]-.1);box(.55,.02,.38,M('#0a0a0f'),0,0,0,laptop)
          lapC=document.createElement('canvas');lapC.width=256;lapC.height=160;lapG=lapC.getContext('2d');lapTex=new THREE.CanvasTexture(lapC);lapTex.colorSpace=THREE.SRGBColorSpace
          const h=at(laptop,G(),0,.01,-.19);h.rotation.x=-.28;box(.55,.36,.015,M('#08080c'),0,.18,0,h)
          const m=new THREE.MeshStandardMaterial({color:0,map:lapTex,emissiveMap:lapTex,emissive:0xffffff,emissiveIntensity:1.7}),s=new THREE.Mesh(new THREE.PlaneGeometry(.5,.31),m);s.position.set(0,.18,.009);h.add(s);mats.push(m)
          laptop.userData.laptop=true;pick.push(laptop)}
        const chair=at(scene,G(),d[0],0,seatZ);const dk=M(cfg.ceo?'#1f2937':cfg.accent,{roughness:.55})
        box(.5,.07,.5,dk,0,.46,0,chair);box(.48,.6,.06,dk,0,.8,.24,chair);cyl(.035,.44,M('#222'),0,.24,0,chair);cyl(.28,.04,M('#222'),0,.03,0,chair,5)
        const R={root:G(),hips:G(),torso:G(),chest:G(),sh:G(),head:G()};scene.add(R.root);R.root.userData.emp=i;R.root.scale.setScalar(.94+((i*37)%11)*.012);pick.push(R.root);R.root.add(R.hips)
        for(const[x,k]of[[-.1,'l'],[.1,'r']]){const l=limb(.44,.44,.075,'#14141c','#14141c',true);l.a.position.x=x;R.hips.add(l.a);R[k+'T']=l.a;R[k+'S']=l.b}
        R.hips.add(R.torso);R.torso.add(R.chest);const shm=M(cfg.shirt,{roughness:.6})
        const ct=new THREE.Mesh(new THREE.CylinderGeometry(.2,.15,.5,14),shm);ct.position.y=.3;ct.castShadow=true;R.chest.add(ct)
        sph(.2,shm,0,.55,0,R.chest).scale.set(1.12,.6,.8);sph(.15,shm,0,.05,0,R.chest)
        if(cfg.ceo)box(.05,.3,.02,M(PU),0,.38,.19,R.chest)
        R.torso.add(R.sh);R.sh.position.y=.55
        for(const[x,k]of[[-.24,'l'],[.24,'r']]){const l=limb(.3,.28,.05,cfg.shirt,cfg.skin);l.a.position.x=x;R.sh.add(l.a);R[k+'A']=l.a;R[k+'E']=l.b}
        R.sh.add(R.head);R.head.position.y=.12
        cyl(.05,.1,M(cfg.skin),0,.06,0,R.head);sph(.13,M(cfg.skin),0,.17,0,R.head)
        const hair=new THREE.Mesh(new THREE.SphereGeometry(.138,20,16,0,PI*2,0,PI*.55),M(cfg.hair,{roughness:.9}));hair.position.set(0,.18,-.012);hair.rotation.x=-.3;R.head.add(hair)
        R.eyes=[-.045,.045].map(x=>{const e=new THREE.Group();e.position.set(x,.18,.112);R.head.add(e)
          const sc=new THREE.Mesh(new THREE.SphereGeometry(.02,10,8),M('#ece7dd',{roughness:.25}));e.add(sc)
          const pu=new THREE.Mesh(new THREE.SphereGeometry(.0095,8,8),M('#15181c',{roughness:.2}));pu.position.z=.012;e.add(pu)
          return{e,pu}})
        R.brows=[-.045,.045].map(x=>box(.05,.009,.008,M(cfg.hair),x,.222,.122,R.head,false))
        R.mouth=box(.05,.014,.01,M('#7a4438'),0,.132,.126,R.head,false)
        sph(.02,M(cfg.skin),0,.165,.13,R.head)
        if(['Sinta','Maya','Putri'].includes(cfg.name))box(.27,.36,.1,M(cfg.hair,{roughness:.9}),0,.1,-.12,R.head)
        if(i%3===0)[-.045,.045].forEach(x=>{const gl=new THREE.Mesh(new THREE.TorusGeometry(.03,.004,6,14),M('#111'));gl.position.set(x,.18,.126);R.head.add(gl)})
        R.phone=at(R.rE,G(),0,-.27,.03);R.phone.rotation.x=-1.25
        box(.08,.15,.012,M('#0a0a12',{metalness:.6,roughness:.3}),0,0,0,R.phone,false)
        box(.06,.12,.004,glow('#9be8c4',1.6),0,0,.008,R.phone,false);R.phone.visible=false
        R.mug=at(R.rE,G(),0,-.3,.02)
        cyl(.035,.08,M('#e5e7eb',{roughness:.4}),0,0,0,R.mug,10)
        const mh=new THREE.Mesh(new THREE.TorusGeometry(.026,.007,6,12),M('#e5e7eb',{roughness:.4}));mh.position.set(.045,0,0);mh.rotation.y=PI/2;R.mug.add(mh);R.mug.visible=false
        const S={pace:rnd(.85,1.15),fat:0,arr:cfg.ceo?400:rnd(412,437),dep:cfg.ceo?990:rnd(900,960),cfg,R,chair,mats,d,seatZ,x:d[0],z:seatZ,yaw:PI,sit:1,ch:0,speed:0,ph:rnd(0,6),wph:0,wp:[],stage:'seated',goal:false,delay:rnd(0,2000),sub:'deep',until:0,glow:1,chatWith:null,speaking:false,report:false,ret:false,reportT:0,spot:SPOTS[i]||SPOTS[4]}
        E.push(S)})

      /* ---------- bubble nama ---------- */
      const bv=new THREE.Vector3()
      E.forEach(S=>{const d=document.createElement('div');d.className='kbb';d.innerHTML='<b></b><i></i>';d.firstChild.textContent=S.cfg.name+' · '+S.cfg.title;bubEl.appendChild(d);S.bb=d;S.bt=0})

      /* ---------- jam sim ---------- */
      const C={min:0,speed:6,brk:false,at:0,live:false},fmt=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(Math.floor(m%60)).padStart(2,'0')
      const wibNow=()=>{const w=new Date(Date.now()+25200000);return w.getUTCHours()*60+w.getUTCMinutes()+w.getUTCSeconds()/60}
      C.live=wibNow()>=435&&wibNow()<885
      C.min=C.live?wibNow():411
      INC.next=C.min+rnd(40,90)
      let sel=null,hov=null

      /* ---------- update per-orang ---------- */
      function update(S,i,dt,t){
        const{R,cfg,d,seatZ}=S,ph=S.ph,zC=cfg.room==='front'?7.5:cfg.room==='back'?-1.5:.8
        if(S.chatWith!=null){const O=E[S.chatWith]
          const bad=!O||O.chatWith!==i||(S.stage!=='seated'&&S.stage!=='report')||S.sub!=='chat'
          if(bad){if(O&&O.chatWith===i){O.chatWith=null;if(O.sub==='chat')O.until=Math.min(O.until,t+.6)}S.chatWith=null}}
        if(S.reportT&&t<S.reportT&&S.stage==='seated'){S.sub='chat';if(S.chatWith==null)S.chatWith=0;S.until=Math.max(S.until,t+1)}
        let best=99,bx=0,bz=1
        E.forEach((o,k)=>{if(k===i||o.stage==='away')return;const dx=o.x-S.x,dz=o.z-S.z,dd=Math.hypot(dx,dz);if(dd<best){best=dd;bx=dx;bz=dz}if(S.stage==='walking'&&dd<.95&&dd>.01){S.x-=dx/dd*(.95-dd)*dt*6;S.z-=dz/dd*(.95-dd)*dt*6}})
        if(!S.init){S.init=1;if(C.min<S.arr||C.min>S.dep){S.stage='away';R.root.visible=false;S.chair.position.z=seatZ+.85;S.ch=1}}
        if(S.stage==='away'){if(C.min>=S.arr&&C.min<S.dep){Object.assign(S,{stage:'walking',arriving:true,leaving:false,x:18,z:.8,sit:0,goal:false,wp:[[8,.8],[3,.8],[3,zC],[d[0],zC],[d[0],seatZ]]});R.root.visible=true;if(Math.random()<.6&&cfg.job!=='CEO'){const pp=S.spot.p;S.goal=true;S.coffee=t+rnd(25,70);S.wp=[[8,.8],S.spot.sit?[8,pp[1]]:[12.3,.8],pp]}}else return}
        if(S.stage==='seated'&&C.min>S.dep&&C.min<S.dep+240&&!S.leaving){S.leaving=true;S.stage='rising'}
        if(S.stage==='seated'&&C.min>=840&&!S.leaving&&!S.coffee&&!C.brk&&cfg.job!=='CEO'&&!INC.active&&Math.random()<dt*.012){S.goal=true;S.coffee=t+rnd(40,90);S.stage='rising'}
        if(!S.leaving&&!S.coffee&&!S.report&&!S.ret&&cfg.job!=='CEO'&&C.brk!==S.goal&&(S.stage==='seated'||S.stage==='lounge')&&performance.now()-C.at>S.delay*(C.live?150:1)){S.goal=C.brk;S.delay=rnd(0,2000);S.stage='rising'}
        const inSeat=S.stage==='seated'
        if((inSeat||S.stage==='lounge')&&t>S.until){const lz=cfg.lazy+(C.min>=840?.4:0),r=Math.random()
          if(S.stage==='lounge'){S.sub=r<.55?'chat':r<.8?'drink':'phone';S.until=t+rnd(4,8)}
          else if(['stretch','scratch','think','drink'].includes(S.sub)){S.sub=r<.5?'phone':'deep';S.until=t+rnd(5,10)}
          else if(r<.12+lz*.3+(S.fat||0)+(C.min>780&&C.min<840?.12:0)+(C.min>=840?.3:0)){S.fat=0;S.sub=Math.random()<.4?(Math.random()<.5?'stretch':'scratch'):'phone';S.until=t+(S.sub==='phone'?rnd(5,10):rnd(2.5,3.5))}
          else if(r<.4+lz*.1&&best<5.6){
            let bj=-1,bd=99
            E.forEach((o,k)=>{if(k===i||o.stage!=='seated')return;if(o.chatWith!=null&&o.chatWith!==i)return;if(o.reportT&&t<o.reportT)return
              const dd=Math.hypot(o.x-S.x,o.z-S.z);if(dd<bd){bd=dd;bj=k}})
            if(bj>=0){const dur=rnd(5,9),O=E[bj]
              S.sub='chat';S.chatWith=bj;S.until=t+dur
              O.sub='chat';O.chatWith=i;O.until=t+dur+rnd(-1,1.5)}
            else{S.sub=Math.random()<.5?'think':'drink';S.until=t+rnd(3,5)}}
          else if(r<.52+lz*.1){S.sub=Math.random()<.5?'think':'drink';S.until=t+rnd(3,5)}
          else{S.fat=(S.fat||0)+.06;S.sub='deep';S.until=t+rnd(7,14)}}
        if(S.sub!==S.lastSub){S.lastSub=S.sub;S.tapOn=S.sub==='phone'&&Math.random()<.6}
        if(S.chatWith!=null){const a=Math.min(i,S.chatWith),b=Math.max(i,S.chatWith)
          S.speaking=Math.floor(t/2.4)%2===0?i===a:i===b}else S.speaking=false
        const sx=d[0]+2,p=S.spot.p;let sitT=1,yawT=S.yaw,pose='stand',sp=0
        if(inSeat){pose=S.sub;yawT=PI}
        else if(S.stage==='rising'){sitT=0;if(S.sit<.1){S.stage='walking';S.hold=t+rnd(.5,2);const m=S.spot.sit?[8,p[1]]:[12.3,.8]
          const side=cfg.room==='back'||cfg.room==='front'
          S.wp=S.leaving?(side?[[sx,seatZ],[sx,zC],[3,zC],[3,.8],[18,.8]]:[[sx,seatZ],[sx,.8],[18,.8]])
            :S.report?[[sx,seatZ],[sx,zC],[7.5,zC],[7.5,-5.4]]
            :S.ret?[[7.5,-5.4],[7.5,zC],[sx,zC],[sx,seatZ]]
            :S.goal?(side?[[sx,seatZ],[sx,zC],[3,zC],[3,.8],[8,.8],m,p]:[[sx,seatZ],[sx,.8],[8,.8],m,p])
            :(side?[[8,.8],[3,.8],[3,zC],[sx,zC],[sx,seatZ]]:[[8,.8],[d[0]+2,.8],[d[0]+2,seatZ]])}}
        else if(S.stage==='walking'){sitT=0;const g=S.wp[0]
          if(!g){if(S.leaving){S.stage='away';S.leaving=false;R.root.visible=false}else if(S.report){S.stage='report';S.until=0}else{S.stage=S.goal?'lounge':'sitting';S.ret=false;S.arriving=false;S.until=0}}
          else if(t>=(S.hold||0)){const dx=g[0]-S.x,dz=g[1]-S.z,dd=Math.hypot(dx,dz);if(dd<.15)S.wp.shift();else{sp=Math.min(1.35*S.pace,dd*2+.3);yawT=Math.atan2(dx,dz);S.x+=dx/dd*S.speed*dt;S.z+=dz/dd*S.speed*dt}}}
        else if(S.stage==='report'){sitT=0;pose='chat';S.chatWith=4
          yawT=Math.atan2(E[4].x-S.x,E[4].z-S.z)
          if(t>INC.endT){S.report=false;S.chatWith=null;S.ret=true;S.until=0;S.stage='rising'
            E[4].chatWith=null;E[4].reportT=0;E[4].until=0
            INC.active=false;INC.boostT=t+45;INC.next=C.min+rnd(140,260)
            showToast('🔧 Hotfix dikerjakan — CTO & tim mode serius')}}
        else if(S.stage==='sitting'){yawT=PI;S.x=dm(S.x,d[0],3,dt);S.z=dm(S.z,seatZ,3,dt);if(S.sit>.96&&Math.hypot(S.x-d[0],S.z-seatZ)<.03){S.stage='seated';S.arriving=false;S.until=0}}
        else if(S.stage==='lounge'){if(S.coffee&&t>S.coffee){S.coffee=0;S.goal=false;S.stage='rising'}const q=S.spot;sitT=q.sit;pose=S.sub;S.x=dm(S.x,q.p[0],3,dt);S.z=dm(S.z,q.p[1],3,dt);yawT=q.sit?q.y:(best<99?Math.atan2(bx,bz):q.y)}
        if(S.stage==='walking'&&S.wp.length>1)for(const o of OBST){const dx=S.x-o.x,dz=S.z-o.z,px=o.hw+.3-Math.abs(dx),pz=o.hd+.3-Math.abs(dz);if(px>0&&pz>0){if(px<pz)S.x+=Math.sign(dx||1)*px*Math.min(1,dt*8);else S.z+=Math.sign(dz||1)*pz*Math.min(1,dt*8)}}
        S.sit=dm(S.sit,sitT,3.2,dt);S.speed=dm(S.speed,sp,3,dt);S.ch=dm(S.ch,(S.stage==='seated'||S.stage==='sitting')?0:1,2.4,dt)
        S.yaw=dma(S.yaw,yawT,S.stage==='walking'?5:3,dt)
        const wk=S.speed/1.35;S.wph+=S.speed*dt*5
        const P=POSE[pose]||POSE.stand,br=Math.sin(t*1.45+ph)
        R.root.position.set(S.x,0,S.z);R.root.rotation.y=S.yaw
        R.hips.position.y=.92-.37*S.sit+Math.abs(Math.sin(S.wph))*.03*wk;R.hips.position.x=Math.sin(t*.3+ph)*.012*S.sit
        R.chest.scale.set(1+br*.012,1+br*.02,1+br*.012)
        R.sh.position.y=.55+br*.012;R.sh.rotation.z=Math.sin(t*.23+ph)*Math.sin(t*.11+ph*2)*.07
        let ty=0,hy=(Math.sin(t*.7+ph)+Math.sin(t*1.9+ph*2)*.5)*(pose==='deep'?.05:.09),hpx=P.hp+Math.sin(t*1.1+ph)*.025+(pose==='deep'?Math.sin(t*7+ph)*.008:0)
        if(S.sub==='chat'&&S.chatWith!=null&&(inSeat||S.stage==='report')){const O=E[S.chatWith];bx=O.x-S.x;bz=O.z-S.z;best=Math.hypot(bx,bz)||.1}
        if(pose==='chat'&&best<99){const dl=wrap(Math.atan2(bx,bz)-S.yaw);ty=clamp(dl*.65,-.9,.9);hy=clamp(dl-ty,-.9,.9)}
        if(S.stage==='walking'&&best<2.5)hy=clamp(wrap(Math.atan2(bx,bz)-S.yaw),-.9,.9)
        if(hov===i){const cx=camera.position.x-S.x,cz=camera.position.z-S.z,cy=camera.position.y-1.6
          const wy=clamp(wrap(Math.atan2(cx,cz)-S.yaw),-1.15,1.15)
          hy=wy;ty=clamp(wy*.28,-.5,.5);hpx=hpx*.35+clamp(-Math.atan2(cy,Math.hypot(cx,cz))*.9,-.55,.3)}
        const tor=R.torso,hd=R.head
        tor.rotation.x=dm(tor.rotation.x,P.tp+(pose==='deep'?Math.sin(t*.35+ph)*.02:0),4,dt);tor.rotation.y=dm(tor.rotation.y,ty,3.5,dt)
        hd.rotation.y=dm(hd.rotation.y,hy,5,dt);hd.rotation.x=dm(hd.rotation.x,hpx,5,dt);hd.rotation.z=Math.sin(t*.5+ph)*.03
        const bl=(t*.31+ph)%1<.05?.08:1
        R.eyes.forEach(({e,pu})=>{e.scale.y=bl
          pu.position.x=clamp(hy*.009,-.007,.007);pu.position.y=clamp(-hpx*.007,-.005,.005)})
        R.brows.forEach((b,k)=>{const up=(S.sub==='chat'||hov===i)?.011:(S.sub==='deep'?-.004:0)
          b.position.y=.222+up+Math.sin(t*.9+ph+k*2)*.0012
          b.rotation.z=(k?-.09:.09)+(S.sub==='deep'?.05:0)})
        if(R.mouth){const talk=S.sub==='chat'?(S.chatWith!=null?(S.speaking?.95:.1):.6):0
          const mm=.25+Math.abs(Math.sin(t*7+ph))*talk
          R.mouth.scale.set(1+talk*.35+(hov===i?.3:0),Math.max(.5,mm*2.2),1)}
        if(R.phone)R.phone.visible=pose==='phone'
        if(R.mug)R.mug.visible=pose==='drink'||(S.stage==='lounge'&&(S.sub==='drink'||S.sub==='chat'))
        for(const[A,Ee,k,key]of[[R.lA,R.lE,-1,'la'],[R.rA,R.rE,1,'ra']]){
          const q=P[key],typ=pose==='deep'?Math.sin(t*(k>0?15:13)+ph)*.05*(.6+.4*Math.sin(t*.9+ph)):0
          const g=pose==='chat'&&k>0?Math.sin(t*2.6+ph)*.22:pose==='phone'?Math.sin(t*1.7+ph)*.05:0
          const sw=S.stage==='walking'?Math.sin(S.wph+(k>0?0:PI))*.55*wk:0
          A.rotation.x=dm(A.rotation.x,q[0]+sw,6,dt);A.rotation.z=dm(A.rotation.z,k*q[1],6,dt);Ee.rotation.x=dm(Ee.rotation.x,q[2]+typ+g,7,dt)}
        for(const[Th,Sh,o,k]of[[R.lT,R.lS,0,0],[R.rT,R.rS,PI,1]]){
          Th.rotation.x=dm(Th.rotation.x,-1.5708*S.sit+Math.sin(S.wph+o)*.5*wk,10,dt)
          let shT=1.5708*S.sit+Math.max(0,-Math.cos(S.wph+o))*.8*wk
          if(k&&inSeat&&S.sub==='phone'&&S.tapOn)shT+=Math.max(0,Math.sin(t*9+ph))*.1
          Sh.rotation.x=dm(Sh.rotation.x,shT,10,dt)}
        S.chair.position.z=seatZ+S.ch*.85;S.chair.rotation.y=dm(S.chair.rotation.y,tor.rotation.y*.4,3,dt)
        S.glow=dm(S.glow,inSeat?({deep:1.7,chat:.9,think:1.2,drink:1.2}[S.sub]??.15):.05,3,dt);S.mats.forEach(m=>m.emissiveIntensity=S.glow)}

      /* ---------- picking (throttled) ---------- */
      const ray=new THREE.Raycaster(),mouse=new THREE.Vector2(),tip=$t('#ktip'),v=new THREE.Vector3()
      const hitAt=(x,y)=>{mouse.set(x/innerWidth*2-1,-(y/innerHeight)*2+1);ray.setFromCamera(mouse,camera)
        const h=ray.intersectObjects(pick,true)[0];if(!h)return null;let o=h.object
        while(o&&o.userData.emp===undefined&&!o.userData.laptop)o=o.parent
        let p=o;while(p){if(p.visible===false)return null;p=p.parent}
        return o}
      let ptrXY=null,rcT=0,down
      const onMove=e=>{ptrXY=[e.clientX,e.clientY]}
      const onLeave=()=>{ptrXY=null;hov=null}
      const onDown=e=>{down=[e.clientX,e.clientY]}
      const onUp=e=>{
        if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return
        const o=hitAt(e.clientX,e.clientY)
        if(o&&o.userData.laptop){runBriefingRef.current&&runBriefingRef.current()}
        else if(o){sel=o.userData.emp;const c=CAST[sel];tip.querySelector('b').firstChild.textContent=c.name;tip.querySelector('span').textContent=c.title
          pickRef.current&&pickRef.current(c.job==='CEO'?'rapat':c.job)}
        else sel=null}
      renderer.domElement.addEventListener('pointermove',onMove)
      renderer.domElement.addEventListener('pointerleave',onLeave)
      renderer.domElement.addEventListener('pointerdown',onDown)
      renderer.domElement.addEventListener('pointerup',onUp)

      /* tombol kecepatan */
      const mode=b=>hud.querySelectorAll('.kbtn').forEach(x=>x.classList.toggle('on',x===b))
      hud.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{C.live=false;C.speed=+b.dataset.s;mode(b)})
      $t('#klive').onclick=e=>{C.live=true;mode(e.currentTarget)}
      $t('#kskip').onclick=e=>{C.live=false;C.min=655;mode(e.currentTarget)}
      mode(C.live?$t('#klive'):hud.querySelector('[data-s="6"]'))

      const onResize=()=>{const w=mount.clientWidth||innerWidth,h=mount.clientHeight||innerHeight
        camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)}
      addEventListener('resize',onResize)

      /* ---------- loop utama ---------- */
      const clk=new THREE.Clock();let uiT=0,frame=0
      renderer.setAnimationLoop(()=>{
        const dt=Math.min(clk.getDelta(),.05),t=clk.elapsedTime;tNow=t
        if(C.live){const w=new Date(Date.now()+25200000);C.min=w.getUTCHours()*60+w.getUTCMinutes()+w.getUTCSeconds()/60}else{C.min+=dt*C.speed;if(C.min>=960)C.min=420}
        const b=C.min>=660&&C.min<780
        if(b!==C.brk){C.brk=b;C.at=performance.now()
          showToast(b?'☕ 11:00 — Istirahat siang, tim ke pantry satu per satu':'13:00 — Istirahat selesai, kembali kerja')}
        if(!INC.active&&C.min>INC.next){
          if(C.min>=430&&C.min<830&&!C.brk&&E[0].stage==='seated'&&E[4].stage==='seated'){
            INC.active=true;const R0=E[0]
            R0.report=true;R0.goal=false;R0.coffee=0;R0.until=1e9;R0.stage='rising'
            E[4].reportT=t+19;E[4].until=1e9
            INC.endT=t+14
            showToast('🐞 Insiden live: bug checkout — CTO lapor ke CEO')}
          else INC.next=C.min+12}
        if(INC.active&&t>INC.endT+4){
          const R0=E[0]
          if(R0.report){R0.report=false;R0.chatWith=null;R0.until=0;R0.ret=true;R0.stage='rising'}
          if(E[4].reportT){E[4].reportT=0;if(E[4].chatWith===0)E[4].chatWith=null;E[4].until=0}
          INC.active=false;INC.boostT=t+45;INC.next=C.min+rnd(140,260)}
        if(PROJ.prog<100){let work=0
          E.forEach(S=>{if(S.stage==='seated'&&S.sub==='deep')work+=S.cfg.job===PHASE_JOB[PROJ.ph]?3:1})
          const boost=INC.boostT>t?2.5:1
          if(work>0)PROJ.prog+=dt*work*.28*boost}
        if(PROJ.prog>=100){PROJ.prog=0;PROJ.done++
          const fin=CHLOG[PROJ.ph];PROJ.ph++
          if(PROJ.ph>=PHASES.length){PROJ.ph=0;PROJ.sprint++
            SITE.ver=Math.round((SITE.ver+.1)*10)/10
            showToast('🚀 Briefing & rilis v'+SITE.ver.toFixed(1)+' terkirim!')}
          else showToast('✅ '+fin+' → '+PHASES[PROJ.ph])}
        E.forEach((S,i)=>update(S,i,dt,t))
        drawBoard2(dt);liveTick(dt);lightTick(dt)
        rackLeds.forEach((m,k)=>m.emissiveIntensity=Math.sin(t*(2+k%5)+k*1.7)>.2?2.2:.12)
        if(frame%2===0)E.forEach(S=>{const bb=S.bb;if(S.stage==='away'){bb.style.opacity=0;return}
          bv.set(S.x,2.05*S.R.root.scale.y,S.z).project(camera);const dist=camera.position.distanceTo(S.R.root.position)
          if(bv.z>1||dist>36){bb.style.opacity=0;return}
          bb.style.opacity=1;bb.style.transform=`translate(${(bv.x*.5+.5)*innerWidth}px,${(-bv.y*.5+.5)*innerHeight}px) translate(-50%,-100%) scale(${clamp(1.5-dist/24,.55,1)})`
          if(t>S.bt){S.bt=t+.5;bb.lastChild.textContent=thought2(S.cfg,S)}})
        rcT-=dt
        if(ptrXY&&rcT<=0){rcT=.07;const o=hitAt(ptrXY[0],ptrXY[1])
          renderer.domElement.style.cursor=o?'pointer':''
          hov=(o&&o.userData.emp!==undefined)?o.userData.emp:null}
        uiT-=dt
        if(uiT<=0){uiT=.15;$t('#ktime').textContent=fmt(C.min)+' WIB';drawWall()
          const ph=$t('#kphase');ph.textContent=C.brk?'Waktu istirahat ☕':(INC.active?'🐞 Insiden — hotfix!':(C.min<420||C.min>=960?'Di luar jam kerja 🌙':'Jam kerja'));ph.style.color=INC.active?'#ef4444':(C.brk?'#fbbf24':EM)
          $t('#kfill').style.width=clamp((C.min-420)/540*100,0,100)+'%'}
        if(sel!==null){const S=E[sel];v.set(S.x,2,S.z).project(camera);tip.style.opacity=1
          tip.style.transform=`translate(${(v.x*.5+.5)*innerWidth-110}px,${(-v.y*.5+.5)*innerHeight-135}px)`
          if(t>S.tt2||!S.tt2){S.tt2=t+.4;tip.lastChild.textContent=thought2(S.cfg,S)}}else tip.style.opacity=0
        if(FOCUS.on){const k=1-Math.exp(-2.8*dt);camera.position.lerp(FOCUS.pos,k);controls.target.lerp(FOCUS.tgt,k)
          if(camera.position.distanceTo(FOCUS.pos)<.25)FOCUS.on=false}
        wallL.visible=camera.position.x>-15.4;wallR.visible=camera.position.x<18.4;wallF.visible=camera.position.z<11.9;ceil.visible=camera.position.y<4.7
        controls.update();renderer.render(scene,camera)
        frame++})

      setLoaded(true)
      setTimeout(()=>showToast('🌐 luxtradee.web.id LIVE — 4 AI Agent siap'),1500)

      /* ---------- cleanup ---------- */
      cleanup=()=>{
        renderer.setAnimationLoop(null)
        removeEventListener('resize',onResize)
        renderer.domElement.removeEventListener('pointermove',onMove)
        renderer.domElement.removeEventListener('pointerleave',onLeave)
        renderer.domElement.removeEventListener('pointerdown',onDown)
        renderer.domElement.removeEventListener('pointerup',onUp)
        focusRef.current=null;pickRef.current=null
        controls.dispose();renderer.dispose()
        ;[renderer.domElement,hud,bubEl,styleEl].forEach(el=>{if(el&&el.parentNode===mount)mount.removeChild(el)})}
    })().catch(err=>{console.error(err);setSceneErr(String(err))})

    return ()=>{disposed=true;cleanup()}
  },[])

  /* ---------- panel kontrol per RUANGAN ---------- */
  const CARD={background:'rgba(255,255,255,.92)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',border:'1px solid rgba(15,23,42,.08)',borderRadius:14,padding:'14px 16px',color:'#1f2437',fontSize:12.5,lineHeight:1.55,minWidth:260,maxWidth:290}
  const BTN={font:'inherit',fontSize:12,padding:'7px 11px',borderRadius:9,cursor:'pointer',border:'1px solid rgba(13,148,136,.45)',background:'rgba(16,185,129,.13)',color:'#0f766e'}
  const BTNP={font:'inherit',fontSize:12,padding:'7px 11px',borderRadius:9,cursor:'pointer',border:'1px solid rgba(124,58,237,.4)',background:'rgba(124,58,237,.1)',color:'#6d28d9'}
  const BTNR={font:'inherit',fontSize:12,padding:'7px 11px',borderRadius:9,cursor:'pointer',border:'1px solid rgba(219,39,119,.4)',background:'rgba(219,39,119,.1)',color:'#be185d'}
  const BTNO={font:'inherit',fontSize:12,padding:'7px 11px',borderRadius:9,cursor:'pointer',border:'1px solid rgba(217,119,6,.4)',background:'rgba(217,119,6,.1)',color:'#b45309'}
  const ERR={marginTop:8,fontSize:11.5,color:'#dc2626'}
  const OKS={marginTop:8,fontSize:11.5,color:'#059669'}
  const SEP={marginTop:8,borderTop:'1px dashed rgba(15,23,42,.15)',paddingTop:8}
  const cto=data&&data.cto,cso=data&&data.cso,cmo=data&&data.cmo,cfo=data&&data.cfo
  const autoacc=(data as any)?.autoacc
  const ROOMS=[['overview','🏢 Semua'],['CTO','🖥️ CTO'],['CSO','👥 CSO'],['CMO','📣 CMO'],['CFO','💰 CFO'],['rapat','🌅 Rapat']]
  const devOpen=process.env.NODE_ENV!=='production'

  return (
    <main style={{position:'fixed',inset:0,background:'linear-gradient(160deg,#dfe7f2,#eef1f7)',overflow:'hidden',fontFamily:'system-ui,sans-serif'}}>
      {gate==='checking'&&(
        <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',color:'#0f766e',fontFamily:'monospace',letterSpacing:'.2em',fontSize:12,zIndex:50,background:'rgba(238,242,247,.72)'}}>
          MEMERIKSA AKSES…
        </div>)}
      {gate==='denied'&&!devOpen&&(
        <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',zIndex:50,padding:16}}>
          <div style={{...CARD,maxWidth:340,textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:8}}>🔒</div>
            <b style={{color:'#0f766e',fontSize:15}}>Ruang CEO Terkunci</b>
            <div style={{marginTop:10,opacity:.85,lineHeight:1.6}}>
              Ruangan ini khusus untuk<br/><b style={{color:'#0f766e'}}>luxtradee@gmail.com</b><br/>
              Login dulu di situs dengan email tersebut, lalu buka halaman ini lagi.
            </div>
            <a href="/auth/login" style={{display:'inline-block',marginTop:14,...BTN,textDecoration:'none'}}>🔑 Ke Halaman Login</a>
          </div>
        </div>)}
      {gate==='denied'&&devOpen&&(
        <div style={{position:'absolute',top:16,left:'50%',transform:'translateX(-50%)',zIndex:40,...CARD,fontSize:11.5,color:'#b45309',borderColor:'rgba(217,119,6,.4)'}}>
          ⚠️ Mode dev — scene terbuka tanpa login. Data API tetap butuh login owner.
        </div>)}

      <div ref={mountRef} style={{position:'absolute',inset:0,overflow:'hidden'}}/>

      {(!loaded&&!sceneErr)&&(
        <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'#eef2f7',color:'#0f766e',fontFamily:'monospace',letterSpacing:'.2em',fontSize:12}}>
          MEMUAT KANTOR 3D…
        </div>)}
      {sceneErr&&(
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',...CARD,maxWidth:300}}>
          ⚠️ Gagal memuat scene 3D: {sceneErr.slice(0,160)}
        </div>)}

      <div style={{position:'absolute',top:16,right:16,zIndex:20,display:'flex',flexDirection:'column',gap:10,maxWidth:274,maxHeight:'calc(100vh - 32px)',overflowY:'auto',paddingBottom:4}}>
        <div style={CARD}>
          <div style={{fontSize:22,fontWeight:700,color:'#0f172a'}}>{clock} <span style={{fontSize:11,opacity:.6}}>WIB</span></div>
          <div style={{opacity:.7,fontSize:11,marginBottom:2,color:'#334155'}}>SUPER AI AGENT · KANTOR CEO<br/><span style={{color:'#0f766e'}}>👤 luxtradee@gmail.com</span>{busy?<span style={{color:'#0d9488'}}> · ⏳ memproses…</span>:null}</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:9}}>
            {ROOMS.map(([id,label])=>(
              <button key={id} className={'kchip'+(room===id?' on':'')} onClick={()=>setRoom(id)}>{label}</button>))}
          </div>
        </div>

        {room==='overview'&&(
          <>
            <div style={CARD}>
              <b style={{color:'#0d9488',fontSize:14}}>🏢 Denah Kantor CEO</b>
              <div style={{marginTop:6,opacity:.85,fontSize:11.5,lineHeight:1.6}}>
                Setiap agen punya <b>ruangan sendiri</b> — klik chip atau karyawan 3D untuk masuk.<br/>
                Klik laptop CEO = jalankan briefing beneran.
              </div>
            </div>
            {cto&&(
              <div style={CARD}><b style={{color:'#0d9488'}}>🖥️ CTO — IT &amp; QA</b><br/>
                Web {cto.siteOk?'✅':'❌'} · Bug 24 jam {cto.bugs24h>=0?cto.bugs24h:'?'}
                {cto.err?<div style={{opacity:.55,fontSize:11}}>{String(cto.err).slice(0,70)}</div>:null}
                <div style={{opacity:.55,fontSize:10.5,marginTop:4}}>→ Buka Ruang CTO untuk Cek Ulang & Diagnostik</div>
              </div>)}
            {cso&&(
              <div style={CARD}><b style={{color:'#db2777'}}>👥 CSO — Customer Success</b><br/>
                Total {cso.total??'—'} · Aktif {cso.active??'—'} · Pasif {cso.passive??'—'}
                {cso.error?<div style={{opacity:.55,fontSize:11,color:'#dc2626'}}>⚠️ {String(cso.error).slice(0,80)}</div>:null}
                <div style={{opacity:.55,fontSize:10.5,marginTop:4}}>→ Buka Ruang CSO untuk ACC EMAIL</div>
              </div>)}
            {cmo&&(
              <div style={CARD}><b style={{color:'#7c3aed'}}>📣 CMO — Draf TikTok</b><br/>
                {cmo.draft?'draf hari ini siap ✅':'belum ada draf'}
                <div style={{opacity:.55,fontSize:10.5,marginTop:4}}>→ Buka Ruang CMO untuk buat & salin draf</div>
              </div>)}
            {cfo&&(
              <div style={CARD}><b style={{color:'#d97706'}}>💰 CFO — Kuota</b><br/>
                {cfo.usedToday??'—'}/{cfo.limit} hari ini · {cfo.status}
              </div>)}
          </>)}

        {/* ============ RUANG CTO — IT & QA ============ */}
        {room==='CTO'&&(
          <div style={CARD}>
            <div style={{fontSize:15,fontWeight:700,color:'#0d9488',marginBottom:4}}>🖥️ RUANG CTO</div>
            <div style={{opacity:.7,fontSize:11,marginBottom:8}}>IT &amp; QA · Monitor sistem & bug</div>
            {cto?(
              <div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontSize:22}}>{cto.siteOk?'✅':'❌'}</span>
                  <div>
                    <b>Website luxtradee.web.id</b><br/>
                    <span style={{opacity:.8}}>{cto.siteOk?`${cto.status} OK · ${cto.latencyMs} ms`:`DOWN (${cto.status||'timeout'})`}</span>
                  </div>
                </div>
                <div style={SEP}>
                  <b>Bug 24 jam terakhir</b><br/>
                  {cto.bugs24h>=0
                    ?<span style={{fontSize:18,fontWeight:700,color:cto.bugs24h>0?'#dc2626':'#059669'}}>{cto.bugs24h}</span>
                    :<span style={{color:'#dc2626'}}>gagal diambil ⚠️</span>}
                </div>
                {cto.upToday!==undefined&&(cto.upToday+cto.downToday)>0?(
                  <div style={{opacity:.75,fontSize:11,marginTop:4}}>🤖 Watchdog hari ini: <b style={{color:'#059669'}}>{cto.upToday}× OK</b> · <b style={{color:cto.downToday>0?'#dc2626':'#94a3b8'}}>{cto.downToday}× gagal</b></div>
                ):cto.upToday===0&&cto.downToday===0?(<div style={{opacity:.55,fontSize:11,marginTop:4}}>🤖 Watchdog belum jalan hari ini — set cron 15 mnt (lihat Ruang Rapat)</div>):null}
                {cto.err?<div style={{opacity:.55,fontSize:11,marginTop:4}}>📝 {String(cto.err).slice(0,130)}</div>:null}
              </div>
            ):(<div style={{opacity:.6,marginTop:6}}>Belum ada data — klik tombol di bawah</div>)}
            <div style={{marginTop:10,display:'flex',flexWrap:'wrap',gap:6}}>
              <button style={BTN} onClick={()=>call('agents&only=cto')}>🔄 Cek Ulang</button>
              <button style={BTNP} onClick={()=>call('diag')}>🩺 Diagnostik</button>
            </div>
            {data&&data.env&&data.profiles&&(
              <div style={{marginTop:8,fontSize:11,lineHeight:1.65,...SEP}}>
                <b style={{color:'#6d28d9'}}>🩺 Hasil Diagnostik</b><br/>
                {['profiles','trades','bug_reports','agent_kv'].map(k=>{const r=data[k]||{};return(
                  <div key={k}>{r.ok?'✅':'❌'} <b>{k}</b>{r.ok?'':<span style={{color:'#dc2626'}}> — {String(r.error||'').slice(0,90)}</span>}</div>)})}
                <div style={{opacity:.6,marginTop:3}}>{Object.entries(data.env).map(([k,v]:any)=>`${k} ${v?'✅':'❌'}`).join(' · ')}</div>
              </div>)}
          </div>)}

        {/* ============ RUANG CSO — Customer Success ============ */}
        {room==='CSO'&&(
          <div style={CARD}>
            <div style={{fontSize:15,fontWeight:700,color:'#db2777',marginBottom:4}}>👥 RUANG CSO</div>
            <div style={{opacity:.7,fontSize:11,marginBottom:8}}>Customer Success · Kelola user & email</div>
            {cso?(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,textAlign:'center'}}>
                  <div style={{background:'rgba(219,39,119,.08)',borderRadius:8,padding:'6px 4px'}}>
                    <div style={{fontSize:18,fontWeight:700,color:'#be185d'}}>{cso.total??'—'}</div>
                    <div style={{fontSize:10,opacity:.7}}>Total</div>
                  </div>
                  <div style={{background:'rgba(16,185,129,.08)',borderRadius:8,padding:'6px 4px'}}>
                    <div style={{fontSize:18,fontWeight:700,color:'#059669'}}>{cso.active??'—'}</div>
                    <div style={{fontSize:10,opacity:.7}}>Aktif</div>
                  </div>
                  <div style={{background:'rgba(217,119,6,.08)',borderRadius:8,padding:'6px 4px'}}>
                    <div style={{fontSize:18,fontWeight:700,color:'#b45309'}}>{cso.passive??'—'}</div>
                    <div style={{fontSize:10,opacity:.7}}>Pasif</div>
                  </div>
                </div>
                {cso.error?<div style={ERR}>⚠️ {String(cso.error).slice(0,130)}</div>:null}
              </div>
            ):(<div style={{opacity:.6,marginTop:6}}>Belum ada data — klik tombol di bawah</div>)}
            <div style={SEP}>
              <b style={{color:'#be185d'}}>📧 ACC EMAIL</b>
              <div style={{opacity:.7,fontSize:11,marginTop:2}}>Kirim email sapaan ke user pasif hari ini</div>
              <button style={{...BTNR,width:'100%',marginTop:6,opacity:acc==='busy'?.5:1}} disabled={acc==='busy'}
                onClick={async()=>{setAcc('busy');const r=await call('acc-email','POST');setAcc(r)}}>
                {acc==='busy'?'⏳ Mengirim…':'📧 ACC EMAIL ke User Pasif'}
              </button>
              {acc&&acc!=='busy'&&(acc.dup
                ?<div style={OKS}>ℹ️ ACC EMAIL sudah dicatat hari ini — besok lagi.</div>
                :acc.ok?<div style={OKS}>✅ ACC tercatat{typeof acc.emailsSent==='number'&&acc.emailsSent>=0?` — ${acc.emailsSent} email terkirim (Resend)`:' — set RESEND_API_KEY utk kirim otomatis'}.</div>
                :<div style={ERR}>❌ {String(acc.error||'gagal').slice(0,140)}</div>)}
            </div>
            <div style={SEP}>
              <b style={{color:'#0f766e'}}>🤖 Mode Otomatis (AUTO-ACC)</b>
              <div style={{opacity:.7,fontSize:11,marginTop:2}}>
                {autoacc===undefined?'memuat status…':autoacc
                  ?'AKTIF ✅ — CSO kirim email ke user pasif OTOMATIS tiap briefing 08:00. Kamu nggak perlu klik apa-apa.'
                  :'OFF — kamu harus klik ACC EMAIL manual tiap hari. Nyalakan biar karyawan kerja sendiri.'}
              </div>
              <button style={{font:'inherit',fontSize:12,padding:'8px 11px',borderRadius:9,cursor:'pointer',width:'100%',marginTop:6,border:'1px solid '+(autoacc?'rgba(5,150,105,.5)':'rgba(100,116,139,.4)'),background:autoacc?'rgba(16,185,129,.15)':'rgba(100,116,139,.08)',color:autoacc?'#047857':'#475569',opacity:busy?.5:1}} disabled={busy}
                onClick={async()=>{await call('auto-acc&on='+(autoacc?'0':'1'),'POST')}}>
                {autoacc?'🔴 Matikan AUTO-ACC':'🟢 Nyalakan AUTO-ACC (sekali klik, permanen)'}
              </button>
            </div>
            <div style={{marginTop:8,display:'flex',flexWrap:'wrap',gap:6}}>
              <button style={BTN} onClick={()=>call('agents&only=cso')}>🔄 Hitung Ulang</button>
            </div>
          </div>)}

        {/* ============ RUANG CMO — Marketing & Copywriter ============ */}
        {room==='CMO'&&(
          <div style={CARD}>
            <div style={{fontSize:15,fontWeight:700,color:'#7c3aed',marginBottom:4}}>📣 RUANG CMO</div>
            <div style={{opacity:.7,fontSize:11,marginBottom:8}}>Marketing &amp; Copywriter AI · Draf TikTok</div>
            {cmo?(
              <div>
                <div style={{background:'rgba(124,58,237,.06)',borderRadius:10,padding:10,whiteSpace:'pre-wrap',opacity:.92,fontSize:12,maxHeight:280,overflowY:'auto',lineHeight:1.6,border:'1px solid rgba(124,58,237,.12)'}}>{cmo.draft||cmo.error||'—'}</div>
                {cmo.usedFallback?<div style={{opacity:.5,marginTop:4,fontSize:11}}>(fallback — Gemini &amp; OpenRouter gagal, revisi manual)</div>:null}
                {cmo.provider==='openrouter'?<div style={{color:'#d97706',marginTop:4,fontSize:11}}>⚡ Cadangan OpenRouter — Gemini lagi 429/error, otomatis pindah</div>:null}
                {cmo.provider==='gemini'?<div style={{opacity:.4,marginTop:2,fontSize:10.5}}>✅ Gemini (utama)</div>:null}
                {cmo.basedOn==='tiktok'?<div style={{color:'#7c3aed',fontSize:10.5,marginTop:2}}>📚 Dianalisis dari {cmo.analyzedPosts} konten TikTok asli lo — pola pemenang ditiru</div>:null}
                {cmo.angle?<div style={{opacity:.5,fontSize:10.5,marginTop:2}}>Angle: {cmo.angle.slice(0,60)}…</div>:null}
              </div>
            ):(<div style={{opacity:.6,marginTop:6}}>Belum ada draf — klik ✍️ untuk generate</div>)}
            <div style={{marginTop:10,display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
              <button style={BTNP} onClick={()=>call('agents&only=cmo')}>✍️ Buat Draf Baru</button>
              <button style={BTN} disabled={!cmo||!cmo.draft} onClick={async()=>{try{await navigator.clipboard.writeText(cmo.draft);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{}}}>📋 Salin</button>
              {copied?<span style={{color:'#059669',fontSize:11}}>tersalin ✅</span>:null}
            </div>
            <div style={{marginTop:10,borderTop:'1px solid rgba(124,58,237,.15)',paddingTop:8}}>
              <b style={{color:'#7c3aed',fontSize:12}}>📚 Bahan Analisis TikTok ({tt.length})</b>
              <div style={{opacity:.6,fontSize:10.5,marginTop:2,lineHeight:1.5}}>Paste link TikTok lo + views/likes — caption diambil OTOMATIS. CMO pelajari 5 konten terbaik tiap bikin draf: makin banyak bahan, makin pintar.</div>
              <div style={{display:'flex',gap:4,marginTop:6,flexWrap:'wrap'}}>
                <input value={ttUrl} onChange={e=>setTtUrl(e.target.value)} placeholder="https://www.tiktok.com/@lo/video/..." style={{flex:'1 1 150px',minWidth:0,fontSize:11.5,padding:'7px 8px',borderRadius:8,border:'1px solid rgba(124,58,237,.25)',background:'rgba(255,255,255,.75)',color:'#1e293b'}}/>
                <input value={ttViews} onChange={e=>setTtViews(e.target.value)} placeholder="views" inputMode="numeric" style={{width:62,fontSize:11.5,padding:'7px 8px',borderRadius:8,border:'1px solid rgba(124,58,237,.25)',background:'rgba(255,255,255,.75)',color:'#1e293b'}}/>
                <input value={ttLikes} onChange={e=>setTtLikes(e.target.value)} placeholder="likes" inputMode="numeric" style={{width:62,fontSize:11.5,padding:'7px 8px',borderRadius:8,border:'1px solid rgba(124,58,237,.25)',background:'rgba(255,255,255,.75)',color:'#1e293b'}}/>
                <button style={{...BTNP,opacity:ttBusy?.5:1,fontSize:11.5}} disabled={ttBusy||!ttUrl.trim()} onClick={ttAdd}>{ttBusy?'⏳':'➕ Tambah'}</button>
              </div>
              {ttMsg?<div style={{fontSize:10.5,marginTop:4,color:ttMsg.startsWith('⚠️')?'#b91c1c':'#047857',opacity:.85}}>{ttMsg}</div>:null}
              {tt.length?(
                <div style={{marginTop:6,maxHeight:150,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
                  {tt.map((p)=>(
                    <div key={p.id} style={{display:'flex',alignItems:'center',gap:6,background:'rgba(124,58,237,.05)',borderRadius:8,padding:'5px 8px'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:10.5,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:'#1e293b'}}>{p.caption||p.url}</div>
                        <div style={{fontSize:9.5,opacity:.55}}>👁 {Number(p.views||0).toLocaleString('id-ID')} · ❤️ {Number(p.likes||0).toLocaleString('id-ID')}</div>
                      </div>
                      <button style={{...BTN,fontSize:10,padding:'4px 8px'}} disabled={ttBusy} onClick={()=>ttDel(p.id)}>🗑</button>
                    </div>
                  ))}
                </div>
              ):<div style={{fontSize:10.5,opacity:.5,marginTop:4}}>Belum ada bahan — CMO masih pakai referensi statis TIKTOK_REFERENCE.</div>}
            </div>
            <div style={{opacity:.5,fontSize:10.5,marginTop:8,lineHeight:1.5}}>
              Draf dibuat Gemini 2.5 Flash · Rotasi angle harian<br/>
              Histori 5 draf terakhir disimpan (anti repetisi)<br/>
              📚 Bahan TikTok lo = acuan utama — isi terus biar draf makin mirin konten yang FYP
            </div>
          </div>)}

        {/* ============ RUANG CFO — API Quota Manager ============ */}
        {room==='CFO'&&(
          <div style={CARD}>
            <div style={{fontSize:15,fontWeight:700,color:'#d97706',marginBottom:4}}>💰 RUANG CFO</div>
            <div style={{opacity:.7,fontSize:11,marginBottom:8}}>API Quota Manager · Anti-429 Gemini Vision</div>
            {cfo?(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  <div style={{background:'rgba(217,119,6,.06)',borderRadius:8,padding:8,textAlign:'center'}}>
                    <div style={{fontSize:10,opacity:.7}}>Hari Ini</div>
                    <div style={{fontSize:20,fontWeight:700,color:'#b45309'}}>{cfo.usedToday??'—'}</div>
                    <div style={{fontSize:10,opacity:.5}}>dari {cfo.limit}</div>
                  </div>
                  <div style={{background:'rgba(100,116,139,.06)',borderRadius:8,padding:8,textAlign:'center'}}>
                    <div style={{fontSize:10,opacity:.7}}>Kemarin</div>
                    <div style={{fontSize:20,fontWeight:700,color:'#475569'}}>{cfo.usedYesterday??'—'}</div>
                    <div style={{fontSize:10,opacity:.5}}>dari {cfo.limit}</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{marginTop:8,height:8,borderRadius:4,background:'rgba(15,23,42,.08)'}}>
                  <div style={{height:'100%',borderRadius:4,background:cfo.status&&String(cfo.status).indexOf('KRITIS')===0?'#dc2626':cfo.status&&String(cfo.status).indexOf('WASPADA')===0?'#d97706':'#059669',width:`${Math.min(100,Math.round(((cfo.usedToday||0)/(cfo.limit||1))*100))}%`,transition:'width .4s'}}/>
                </div>
                <div style={{marginTop:6}}>
                  Event 429 kemarin: <b>{cfo.quota429??'—'}</b><br/>
                  Email hari ini: <b>{cfo.emailToday??'—'}/{cfo.emailLimit??100}</b> (Resend)<br/>
                  Status: <b style={{color:cfo.status&&String(cfo.status).indexOf('KRITIS')===0?'#dc2626':cfo.status&&String(cfo.status).indexOf('WASPADA')===0?'#d97706':'#059669'}}>{cfo.status??''}</b>
                </div>
                {cfo.error?<div style={ERR}>⚠️ {String(cfo.error).slice(0,120)}</div>:null}
              </div>
            ):(<div style={{opacity:.6,marginTop:6}}>Belum ada data — klik tombol di bawah</div>)}
            <div style={{marginTop:10,display:'flex',flexWrap:'wrap',gap:6}}>
              <button style={BTN} onClick={()=>call('quota')}>🔄 Refresh Kuota</button>
              <button style={BTNO} onClick={()=>call('agents&only=cfo')}>📊 Cek Ulang</button>
            </div>
          </div>)}

        {/* ============ RUANG RAPAT — CEO Suite ============ */}
        {room==='rapat'&&(
          <div style={CARD}>
            <div style={{fontSize:15,fontWeight:700,color:'#0f766e',marginBottom:4}}>🌅 RUANG RAPAT</div>
            <div style={{opacity:.7,fontSize:11,marginBottom:8}}>CEO Suite · Briefing & kontrol utama</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              <button style={{...BTN,opacity:busy?.5:1}} disabled={busy} onClick={()=>call('briefing','POST')}>
                {busy?'⏳ Jalan…':'🌅 Briefing + Discord'}
              </button>
              <button style={BTN} onClick={()=>call('briefing-last')}>📜 Terakhir</button>
              <button style={BTNO} onClick={()=>call('discord-test')}>🧪 Tes Discord</button>
              <button style={BTN} onClick={()=>call('watchdog')}>🕵️ Jalankan Watchdog</button>
              <button style={BTNP} onClick={()=>call('weekly')}>📊 Laporan Mingguan</button>
            </div>
            {(data&&data.ok!==undefined&&!data.cto&&!data.cso)&&(
              <div style={data.ok?OKS:ERR}>
                🧪 Tes Discord: {data.ok?'berhasil — cek channel Discord ✅':String(data.error||'gagal').slice(0,140)}
              </div>)}
            {data&&data.watch&&(
              <div style={OKS}>
                🕵️ Watchdog: situs {data.siteOk?'✅ OK':'❌ DOWN'}{data.quota?` · kuota ${data.quota}`:''} · {data.alerts&&data.alerts.length?`🔔 ${data.alerts.length} alert dikirim ke Discord`:'semua aman — tanpa alarm'}
              </div>)}
            {data&&data.text&&(
              <div style={{marginTop:8}}>
                <b>Discord:</b> {data.notifySent?'✅ terkirim':`❌ ${data.notifyErr||'gagal — klik 🧪 Tes Discord'}`}
                <div style={{whiteSpace:'pre-wrap',marginTop:6,opacity:.8,fontSize:11.5,maxHeight:260,overflowY:'auto',background:'rgba(15,23,42,.04)',borderRadius:8,padding:8}}>{data.text}</div>
              </div>)}
            {data&&data.error&&data.text===undefined&&data.ok===undefined&&(<div style={ERR}>⚠️ {String(data.error).slice(0,200)}</div>)}
            <div style={SEP}>
              <b>⚙️ Jadwal Kerja Karyawan — OTOMATIS ✅</b>
              <div style={{opacity:.75,fontSize:10.5,marginTop:4,lineHeight:1.8}}>
                🌅 <b>Briefing pagi</b> 08:00 WIB tiap hari (4 agen + AUTO-ACC)<br/>
                🕵️ <b>Watchdog CTO</b> tiap 15 menit 24/7 — situs DOWN / bug baru / kuota 80% → alarm Discord INSTAN<br/>
                📊 <b>Laporan mingguan</b> Senin 10:00 WIB<br/>
                ⚡ Semua jalan lewat <b>Cloudflare Cron bawaan</b> — tanpa cron-job.org, tanpa setup manual.
              </div>
            </div>
            <div style={{...SEP,opacity:.55,fontSize:10.5,lineHeight:1.5}}>
              <b>Cron 08:00 WIB:</b> Cloudflare trigger → /api/ceo-agent?action=briefing&amp;key=CRON_SECRET<br/>
              <b>Akses:</b> login luxtradee@gmail.com · token JWT otomatis
            </div>
          </div>)}
      </div>
    </main>
  )
}
