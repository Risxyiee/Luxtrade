// Probe PineTS API: broker fills, alerts, inputs, error lines
import { PineTS, Indicator } from 'pinets';

// --- data uji: 30 candle sintetis H1 ---
const base = 1731384000000; // ms UTC open
const mk = (i, o, h, l, c) => ({ openTime: base + i * 3600000, open: o, high: h, low: l, close: c, volume: 1000 });
const candles = [];
for (let i = 0; i < 30; i++) candles.push(mk(i, 2000, 2002, 1998, 2001));

// ============ PROBE 1: strategy limit entry fill timing ============
{
  const pineTS = new PineTS(candles.map((c, i) => (i === 10 ? { ...c, low: 1990, high: 2001 } : c)));
  pineTS.setAlertMode('all');
  const ctx = await pineTS.run(`
//@version=6
strategy("Probe Limit", overlay=true, default_qty_type=strategy.fixed, default_qty_value=1)
if bar_index == 5
    strategy.entry("L1", strategy.long, qty=2, limit=1995)
if bar_index == 20
    strategy.close_all()
`);
  const s = ctx.strategy;
  console.log('P1 position_size:', s.position_size);
  console.log('P1 closedtrades:', s.closedtrades.map(t => ({ entry_id: t.entry_id, entry_price: t.entry_price, entry_bar: t.entry_bar_index, exit_price: t.exit_price, exit_bar: t.exit_bar_index })));
  console.log('P1 pending:', s.pending_orders.map(o => ({ id: o.id, status: o.status, fill_bar: o.fill_bar, fill_price: o.fill_price })));
}

// ============ PROBE 2: alert() + alertcondition di mode 'all' ============
{
  const pineTS = new PineTS(candles);
  pineTS.setAlertMode('all');
  const ctx = await pineTS.run(`
//@version=6
indicator("Probe Alert")
alertcondition(close > close[1], "AC Title", "AC message {{ticker}}")
if bar_index == 3
    alert('{"event":"SIGNAL","side":"BUY","bar":3}', alert.freq_once_per_bar)
`);
  console.log('P2 alerts:', JSON.stringify(ctx.alerts));
}

// ============ PROBE 3: time builtin (ms atau s?) ============
{
  const pineTS = new PineTS(candles);
  const ctx = await pineTS.run(`
//@version=6
indicator("Probe Time")
plot(time, "T")
plot(time_close, "TC")
`);
  console.log('P3 time[0]:', ctx.plots['T']?.data?.[0], ' time[10]:', ctx.plots['T']?.data?.[10]);
  console.log('P3 time_close[0]:', ctx.plots['TC']?.data?.[0]);
}

// ============ PROBE 4: runtime input via Indicator ============
{
  const ind = new Indicator(`
//@version=6
indicator("Probe Input")
len = input.int(5, "Len")
plot(ta.sma(close, len), "S")
`, { Len: 3 });
  const pineTS = new PineTS(candles);
  const ctx = await pineTS.run(ind);
  console.log('P4 last SMA(len=3):', ctx.plots['S']?.data?.at(-1));
}

// ============ PROBE 5: syntax error line number ============
{
  try {
    const pineTS = new PineTS(candles.slice(0, 5));
    await pineTS.run(`//@version=6
indicator("Probe Err")
a = 1
b = = 2
`);
  } catch (e) {
    console.log('P5 syntax err:', e.message?.slice(0, 200));
  }
}

// ============ PROBE 6: loop guard (infinite loop) ============
{
  try {
    const pineTS = new PineTS(candles.slice(0, 5));
    pineTS.setMaxLoops(1000);
    const t0 = Date.now();
    await pineTS.run(`//@version=6
indicator("Probe Loop")
while true
    x = 1
`);
    console.log('P6 no error?', Date.now() - t0, 'ms');
  } catch (e) {
    console.log('P6 loop err:', e.constructor?.name, e.message?.slice(0, 150), Date.now() - 'T0');
  }
}

// ============ PROBE 7: strategy.exit bracket stop/limit, same-bar both ============
{
  const c2 = candles.map((c, i) => {
    if (i === 11) return { ...c, open: 2000, high: 2030, low: 1970, close: 2000 }; // both hit
    return c;
  });
  const pineTS = new PineTS(c2);
  const ctx = await pineTS.run(`
//@version=6
strategy("Probe Bracket", overlay=true, default_qty_type=strategy.fixed, default_qty_value=1)
if bar_index == 5
    strategy.entry("L1", strategy.long, limit=1995)
if bar_index == 10
    strategy.exit("X1", from_entry="L1", stop=1980, limit=2020)
`);
  console.log('P7 closed:', ctx.strategy.closedtrades.map(t => ({ exit_id: t.exit_id, exit_price: t.exit_price, exit_bar: t.exit_bar_index })));
}

// ============ PROBE 8: strategy.cancel ============
{
  const pineTS = new PineTS(candles);
  const ctx = await pineTS.run(`
//@version=6
strategy("Probe Cancel", overlay=true)
if bar_index == 5
    strategy.entry("L1", strategy.long, limit=1950)
if bar_index == 8
    strategy.cancel("L1")
`);
  console.log('P8 pending after cancel:', JSON.stringify(ctx.strategy.pending_orders.map(o => ({ id: o.id, status: o.status }))));
}

// ============ PROBE 9: session/time dalam Pine: timestamp + hour ============
{
  const pineTS = new PineTS(candles);
  const ctx = await pineTS.run(`
//@version=6
indicator("Probe Hour")
h = hour(time, "Asia/Jakarta")
plot(h, "H")
m = minute(time, "Asia/Jakarta")
plot(m, "M")
`);
  console.log('P9 hour[0]:', ctx.plots['H']?.data?.[0], 'minute[0]:', ctx.plots['M']?.data?.[0]);
}

// ============ PROBE 10: ta.dmi + ta.pivothigh tersedia? ============
{
  const pineTS = new PineTS(candles);
  const ctx = await pineTS.run(`
//@version=5
indicator("Probe TA")
[diplus, diminus, adx] = ta.dmi(10, 14)
ph = ta.pivothigh(3, 3)
plot(adx, "ADX")
plot(ph, "PH")
`);
  console.log('P10 adx[25]:', ctx.plots['ADX']?.data?.[25], 'PH[25]:', ctx.plots['PH']?.data?.[25]);
}
console.log('PROBE DONE');
