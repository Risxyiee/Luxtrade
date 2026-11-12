// Probe PineTS batch 2
import { PineTS, Indicator } from 'pinets';

const base = 1731384000000;
const mk = (i, o, h, l, c) => ({ openTime: base + i * 3600000, open: o, high: h, low: l, close: c, volume: 1000 });
const candles = [];
for (let i = 0; i < 30; i++) candles.push(mk(i, 2000, 2002, 1998, 2001));

// ============ P11: alertcondition mode 'all' — muncul di ctx.alerts? ============
{
  const pineTS = new PineTS(candles.slice(0, 12));
  pineTS.setAlertMode('all');
  const ctx = await pineTS.run(`
//@version=6
indicator("P11")
alertcondition(close > 2000, "BuyX", "BUY alert")
`);
  console.log('P11 alerts:', ctx.alerts.length, JSON.stringify(ctx.alerts.slice(0, 2)));
}

// ============ P12: strategy fill → alert_message masuk ctx.alerts? ============
{
  const c2 = candles.map((c, i) => (i === 10 ? { ...c, low: 1990 } : c));
  const pineTS = new PineTS(c2);
  pineTS.setAlertMode('all');
  const ctx = await pineTS.run(`
//@version=6
strategy("P12", overlay=true, default_qty_type=strategy.fixed, default_qty_value=1)
if bar_index == 5
    strategy.entry("L1", strategy.long, limit=1995, alert_message='{"ev":"ENTRY"}')
`);
  console.log('P12 alerts:', JSON.stringify(ctx.alerts));
  console.log('P12 trade entry_comment:', ctx.strategy.closedtrades[0]?.entry_comment);
}

// ============ P13: entry limit fill lalu SL kena di BAR YANG SAMA ============
{
  const c3 = candles.map((c, i) => (i === 10 ? { ...c, open: 2000, high: 2002, low: 1970, close: 1975 } : c));
  const pineTS = new PineTS(c3);
  const ctx = await pineTS.run(`
//@version=6
strategy("P13", overlay=true, default_qty_type=strategy.fixed, default_qty_value=1)
if bar_index == 5
    strategy.entry("L1", strategy.long, limit=1995)
if bar_index == 5
    strategy.exit("X1", from_entry="L1", stop=1980, limit=2040)
`);
  const s = ctx.strategy;
  console.log('P13 pos:', s.position_size, 'open:', s.opentrades.length, 'closed:', s.closedtrades.map(t => ({ entry_price: t.entry_price, entry_bar: t.entry_bar_index, exit_price: t.exit_price, exit_bar: t.exit_bar_index })));
}

// ============ P14: //@version=5 + ta.dmi + pivothigh ============
{
  const pineTS = new PineTS(candles);
  const ctx = await pineTS.run(`
//@version=5
indicator("P14", overlay=true)
[diplus, diminus, adx] = ta.dmi(10, 14)
ph = ta.pivothigh(high, 3, 3)
plot(adx, "ADX")
plot(ph, "PH")
`);
  const adx = ctx.plots['ADX'];
  console.log('P14 adx sample:', JSON.stringify(adx?.data?.filter(d => d && d.value !== null && !Number.isNaN(d.value))?.slice(0, 1)), 'len:', adx?.data?.length);
}

// ============ P15: nilai na → bentuk data plot (null/NaN?) ============
{
  const pineTS = new PineTS(candles);
  const ctx = await pineTS.run(`
//@version=6
indicator("P15")
v = ta.sma(close, 20)
plot(v, "V")
`);
  console.log('P15 data[0]:', JSON.stringify(ctx.plots['V']?.data?.[0]), 'data[19]:', JSON.stringify(ctx.plots['V']?.data?.[19]));
}

// ============ P16: unsupported function → error saat transpile atau runtime? ============
{
  try {
    const pineTS = new PineTS(candles.slice(0, 6));
    await pineTS.run(`//@version=6
indicator("P16")
v = ta.fakethings(close, 5)
plot(v)
`);
    console.log('P16: NO ERROR');
  } catch (e) {
    console.log('P16 err:', e.constructor?.name, '|', e.message?.slice(0, 160));
  }
}

// ============ P17: import statement (harus bisa diblokir) ============
{
  try {
    const pineTS = new PineTS(candles.slice(0, 6));
    await pineTS.run(`//@version=6
indicator("P17")
import user/lib/1 as lib
plot(lib.f(close))
`);
    console.log('P17: NO ERROR (tanpa resolver)');
  } catch (e) {
    console.log('P17 err:', e.message?.slice(0, 160));
  }
}

// ============ P18: request.security dengan array data (jaringan?) ============
{
  try {
    const pineTS = new PineTS(candles.slice(0, 8));
    const ctx = await pineTS.run(`//@version=6
indicator("P18")
[h, l] = request.security(syminfo.tickerid, "D", [high, low])
plot(h)
`);
    console.log('P18 ok, len:', ctx.plots?.plot?.data?.length ?? Object.keys(ctx.plots ?? {}).length);
  } catch (e) {
    console.log('P18 err:', e.message?.slice(0, 160));
  }
}
console.log('PROBE2 DONE');
