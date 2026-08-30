module.exports=[37238,e=>{"use strict";async function t(e,a={}){let r=Math.max(1,a.maxRetries??2),o=a.timeout??9e4,n=process.env.GEMINI_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;if(!n)throw Error("GEMINI_API_KEY is not configured");for(let t=0;t<r;t++)try{console.log(`🤖 [Gemini 2.5 Flash] Attempt ${t+1}/${r}`);let a=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${n}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:e,generationConfig:{temperature:.1,maxOutputTokens:2048}}),signal:AbortSignal.timeout(o)});if(!a.ok){let e=await a.text();if(console.error(`❌ [Gemini 2.5 Flash] Error ${a.status}:`,e.slice(0,200)),429===a.status&&t<r-1){let e=3e3*(t+1);console.log(`⏳ [Gemini 2.5 Flash] Rate limited, waiting ${e}ms...`),await new Promise(t=>setTimeout(t,e));continue}throw Error(`Gemini API error (${a.status}): ${e.slice(0,200)}`)}let i=await a.json(),s=i.candidates?.[0]?.content?.parts?.[0]?.text||"";if(!s.trim())throw Error("Empty response from Gemini API");return console.log(`✅ [Gemini 2.5 Flash] Success: ${s.length} chars`),{text:s,raw:i,provider:"gemini-2.5-flash"}}catch(e){if("AbortError"===e.name||"TimeoutError"===e.name){if(t<r-1){await new Promise(e=>setTimeout(e,3e3));continue}throw Error("Gemini API timeout.")}if(t===r-1)throw e;console.warn(`⚠️ [Gemini 2.5 Flash] Retrying...`,e.message),await new Promise(e=>setTimeout(e,2e3*(t+1)))}throw Error("All Gemini API attempts failed")}function a(){return"meta-llama/llama-4-scout:free"}async function r(e,t,o={}){let{timeout:n=9e4}=o,i=process.env.OPENROUTER_API_KEY;if(!i)throw Error("OPENROUTER_API_KEY is not configured");let s=await a();console.log(`🤖 [OpenRouter] Attempting with model: ${s}`);let l=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${i}`,"HTTP-Referer":"https://luxtrade.id","X-Title":"LuxTrade"},body:JSON.stringify({model:s,messages:[{role:"user",content:[{type:"text",text:t},{type:"image_url",image_url:{url:`data:image/jpeg;base64,${e}`}}]}],temperature:.1,max_tokens:2048}),signal:AbortSignal.timeout(n)});if(!l.ok){let e=await l.text();throw console.error(`❌ [OpenRouter] Error ${l.status}:`,e.slice(0,200)),Error(`OpenRouter API error (${l.status}): ${e.slice(0,200)}`)}let u=await l.json(),m=u.choices?.[0]?.message?.content||"";if(!m.trim())throw Error("Empty response from OpenRouter API");return console.log(`✅ [OpenRouter] Success (${s}): ${m.length} chars`),{text:m,raw:u,provider:`openrouter:${s}`}}async function o(e,t,a={}){let r=e instanceof Uint8Array?e:new Uint8Array(e),i="";for(let e=0;e<r.length;e++)i+=String.fromCharCode(r[e]);return n(btoa(i),t,a)}async function n(e,a,o={}){let i=null;try{return await t([{role:"user",parts:[{text:a},{inline_data:{mime_type:"image/jpeg",data:e}}]}],o)}catch(e){i=e,console.warn(`⚠️ [Fallback] Gemini 2.5 Flash failed: ${e.message}`)}i?.message?.includes("429")||(console.log(`⏳ [Fallback] Waiting 2s before trying OpenRouter...`),await new Promise(e=>setTimeout(e,2e3)));try{return await r(e,a,o)}catch(e){console.error(`❌ [Fallback] OpenRouter also failed: ${e.message}`)}let s=i?.message||"unknown error";if(s.includes("not configured"))throw Error("API key AI belum dikonfigurasi (GEMINI_API_KEY). Hubungi admin atau cek pengaturan environment.");throw Error(`AI analysis gagal: ${s}. Coba lagi dalam beberapa detik.`)}async function i(e,r={}){try{return await t([{role:"user",parts:[{text:e}]}],r)}catch(e){console.warn(`⚠️ [Text Fallback] Gemini failed: ${e.message}`)}await new Promise(e=>setTimeout(e,2e3));try{let t=process.env.OPENROUTER_API_KEY;if(!t)throw Error("OPENROUTER_API_KEY not configured");let o=await a();console.log(`🤖 [OpenRouter Text] Using model: ${o}`);let n=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`,"HTTP-Referer":"https://luxtrade.id","X-Title":"LuxTrade"},body:JSON.stringify({model:o,messages:[{role:"user",content:e}],temperature:.1,max_tokens:2048}),signal:AbortSignal.timeout(r.timeout||9e4)});if(!n.ok){let e=await n.text();throw Error(`OpenRouter error (${n.status}): ${e.slice(0,200)}`)}let i=await n.json(),s=i.choices?.[0]?.message?.content||"";if(!s.trim())throw Error("Empty response from OpenRouter");return console.log(`✅ [OpenRouter Text] Success: ${s.length} chars`),{text:s,raw:i,provider:`openrouter:${o}`}}catch(e){console.error(`❌ [Text Fallback] OpenRouter also failed: ${e.message}`)}throw Error("Semua provider AI gagal. Coba lagi nanti.")}async function s(e,t,a,r={}){try{return await o(e,t,r)}catch(e){console.warn(`⚠️ [Fallback] Vision failed: ${e.message}. Trying text-only...`)}return i(a,r)}let l=`You are an expert at reading trading platform screenshots and extracting trade information.

Analyze this trading screenshot and extract ALL trade information visible.
The screenshot could be:
1. A trade history table (MT4/MT5 list view) showing multiple or single trades
2. A trading chart with trade markers/entry-exit points
3. A trade details/summary panel
4. Any combination of the above

Extract these fields:
- symbol: Currency pair or asset name (e.g., XAUUSD, EURUSD, GBPJPY, BTC/USD)
- type: "buy" or "sell" (lowercase)
- openPrice: Opening/entry price as number
- closePrice: Closing/exit price as number
- profitLoss: Profit/loss amount as number (negative for loss, e.g., -99.75)
- openTime: Opening/entry date and time (format: YYYY-MM-DD HH:mm:ss)
- closeTime: Closing/exit date and time (format: YYYY-MM-DD HH:mm:ss)
- stopLoss: Stop loss price if visible (number)
- takeProfit: Take profit price if visible (number)
- volume: Lot size if visible (number, e.g., 0.05)
- ticketNumber: Trade ticket/order number if visible (string)

RULES:
1. Return ONLY valid JSON, no markdown, no explanation, no backticks
2. All prices must be numbers not strings
3. type must be exactly "buy" or "sell" (lowercase)
4. If a field is not visible in the screenshot, use null (not undefined, not empty string)
5. For dates like "2026.06.23 06:04:10" convert to "2026-06-23 06:04:10"
6. For profit shown as "-99.75" or "$ -1995" or "-1995 (-0.48%)", extract just the number: -99.75
7. Look for:
   - S/L (stop loss), TP (take profit) labels
   - Entry and exit prices on chart
   - Bid/ask prices on table rows
   - Timestamps near prices
8. If it's a chart, look for:
   - Horizontal lines marking entry, stop loss, take profit
   - Labels with "BUY" or "SELL"
   - Timestamps on the bottom
   - Price levels on the right
9. If multiple trades visible, extract ONLY the most recent or active one
10. For profit calculation, if entry is 4140.35 and exit is 4120.40, the difference is -19.95

Example outputs:
{"symbol":"XAUUSD","type":"buy","openPrice":4140.35,"closePrice":4120.40,"profitLoss":-99.75,"openTime":"2026-06-23 06:04:10","closeTime":"2026-06-23 07:59:11","stopLoss":4120.40,"takeProfit":4182.15,"volume":0.05,"ticketNumber":"918673848"}

{"symbol":"EURUSD","type":"sell","openPrice":1.0875,"closePrice":1.0850,"profitLoss":250,"openTime":"2026-06-23 10:30:00","closeTime":"2026-06-23 11:45:00","stopLoss":1.0900,"takeProfit":1.0825,"volume":0.1,"ticketNumber":null}

Return the JSON now:
`;function u(e="id"){let t="id"===e,a=t?`PART 2 — Buat analisis jurnal trading singkat (3-4 kalimat) DALAM BAHASA INDONESIA:
- journalTitle: Judul singkat deskriptif (contoh: "Gold Short di Area Resistance")
- journalContent: Analisis 3-4 kalimat mencakup: setup/strategi yang dipakai, kondisi market, pelajaran utama. WAJIB ditulis dalam Bahasa Indonesia yang natural dan professional — bukan terjemahan kaku. Gunakan istilah trading yang umum dipakai trader Indonesia (entry, stop loss, take profit, breakout, pullback, dll).
- mood: Salah satu dari: confident, nervous, calm, fearful, greedy, neutral
- marketCondition: Salah satu dari: trending, ranging, volatile, bullish, bearish
- tags: 2-4 tag relevan sebagai string dipisah koma (contoh: "gold,breakout,loss")
- setupType: Nama strategi (contoh: breakout, pullback, momentum, scalping, swing)`:`PART 2 — Generate a brief trading journal analysis (3-4 sentences):
- journalTitle: Short descriptive title (e.g., "Gold Short at Resistance Level")
- journalContent: 3-4 sentence analysis covering: setup/strategy used, market condition, key takeaway
- mood: One of: confident, nervous, calm, fearful, greedy, neutral
- marketCondition: One of: trending, ranging, volatile, bullish, bearish
- tags: 2-4 relevant tags as comma-separated string (e.g., "gold,breakout,loss")
- setupType: Strategy name (e.g., breakout, pullback, momentum, scalping, swing)`,r=t?`
IMPORTANT: All text fields (journalTitle, journalContent, tags) MUST be written in Bahasa Indonesia. Trade data fields (symbol, type, prices, dates) tetap apa adanya sesuai screenshot.`:`
All journal text fields should be written in English.`;return`You are an expert trading analyst. Analyze this trading screenshot and return a SINGLE JSON object with TWO parts.

PART 1 — Extract trade data:
- symbol: Currency pair (e.g., XAUUSD, EURUSD)
- type: "buy" or "sell" (lowercase)
- openPrice: Entry price (number)
- closePrice: Exit price (number)
- profitLoss: P/L amount (number, negative for loss)
- openTime: "YYYY-MM-DD HH:mm:ss"
- closeTime: "YYYY-MM-DD HH:mm:ss"
- stopLoss: SL price if visible (number or null)
- takeProfit: TP price if visible (number or null)
- volume: Lot size if visible (number or null)
- ticketNumber: Ticket number if visible (string or null)

${a}

RULES:
1. Return ONLY a single JSON object, no markdown, no explanation, no backticks
2. All prices must be numbers
3. type must be exactly "buy" or "sell"
4. Missing fields → null
${t?"5. Journal content harus ringkas (maks 3-4 kalimat) agar respons tetap cepat. WAJIB dalam Bahasa Indonesia.":"5. Journal content must be concise (3-4 sentences max) to keep response fast"}
6. Tags must be lowercase, comma-separated
7. If multiple trades visible, analyze the most recent one
${r}

Example:
{"symbol":"XAUUSD","type":"buy","openPrice":4140.35,"closePrice":4120.40,"profitLoss":-99.75,"openTime":"2026-06-23 06:04:10","closeTime":"2026-06-23 07:59:11","stopLoss":4120.40,"takeProfit":4182.15,"volume":0.05,"ticketNumber":"918673848","journalTitle":"${t?"Gold Long Ditolak di Resistance":"Gold Long Rejected at Resistance"}","journalContent":"${t?"Entry long XAUUSD di 4140.35 setelah breakout bullish. Harga ditolak di resistance dan berbalik tajam, menyentuh stop loss di 4120.40. Setup kurang konfirmasi dari timeframe lebih besar — hindari trading melawan resistance kuat tanpa konfluence. Contoh baik untuk belajar menahan diri saat belum ada konfirmasi jelas.":"Entered long on XAUUSD at 4140.35 after a bullish breakout attempt. Price was rejected at resistance and reversed sharply, hitting stop loss at 4120.40. The setup lacked confirmation from higher timeframe — avoid trading against strong resistance without confluence."}","mood":"nervous","marketCondition":"ranging","tags":"gold,breakout,loss,resistance","setupType":"breakout"}

Return the JSON now:`}let m=u("id");e.s(["TRADE_AND_JOURNAL_PROMPT",0,m,"TRADE_EXTRACTION_PROMPT",0,l,"analyzeImageBase64",0,n,"analyzeImageBase64WithAiml",()=>n,"analyzeImageWithAiml",()=>o,"analyzeTextWithZyloo",()=>i,"analyzeWithFallback",()=>s,"buildTradeAndJournalPrompt",()=>u])}];

//# sourceMappingURL=src_lib_aiml-vision_ts_955b510c._.js.map