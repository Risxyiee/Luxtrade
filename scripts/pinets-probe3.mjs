// Probe PineTS batch 3: str.*, array.*, gap fill, entry+TP same bar
import { PineTS } from 'pinets';

const base = 1731384000000;
const mk = (i, o, h, l, c) => ({ openTime: base + i * 3600000, open: o, high: h, low: l, close: c, volume: 1000 });
const candles = [];
for (let i = 0; i < 30; i++) candles.push(mk(i, 2000, 2002, 1998, 2001));

// P19: str.format / str.tostring format / concat
{
  const pineTS = new PineTS(candles.slice(0, 3));
  const ctx = await pineTS.run(`//@version=6
indicator("P19")
s1 = str.format("a={0} b={1}", 12.345, "x")
s2 = str.tostring(23.456, "#.##")
s3 = "pre" + s2 + "post"
n = str.tostring(time)
plot(1, "P", color=color.blue)
if bar_index == 1
    alert(s1, alert.freq_once_per_bar)
    alert(s3, alert.freq_once_per_bar)
    alert(n, alert.freq_once_per_bar)
`);
  console.log('P19 alerts:', JSON.stringify(ctx.alerts.map(a => a.message)));
}

// P20: input.string options + input.float + input.bool
{
  const pineTS = new PineTS(candles.slice(0, 3));
  const ctx = await pineTS.run(`//@version=6
indicator("P20")
mode = input.string("CLOSE", "retestMode", options=["OPEN", "MID", "CLOSE"])
f = input.float(20.0, "slUsd")
b = input.bool(false, "allowShort")
v = mode == "CLOSE" ? 1 : 2
plot(v + f + (b ? 100 : 0), "V")
`);
  console.log('P20 v:', JSON.stringify(ctx.plots['V']?.data?.[0]));
}

// P21: array + for loop (pivot emulation)
{
  const pineTS = new PineTS(candles.slice(0, 10));
  const ctx = await pineTS.run(`//@version=6
indicator("P21")
var highs = array.new_float(0)
array.push(highs, high)
if array.size(highs) > 30
    array.shift(highs)
isH = false
n = array.size(highs)
if n >= 7
    center = array.get(highs, n - 4)
    isH = true
    for i = 1 to 3
        left = array.get(highs, n - 4 - i)
        right = array.get(highs, n - 4 + i)
        if not (center > left) or not (center >= right)
            isH := false
plot(isH ? 1 : 0, "IS")
`);
  console.log('P21 isH:', JSON.stringify(ctx.plots['IS']?.data?.slice(-3)));
}

// P22: gap open melalui level limit -> fill di open?
{
  const c2 = candles.map((c, i) => (i === 10 ? { ...c, open: 1990, high: 1996, low: 1988, close: 1992 } : c));
  const pineTS = new PineTS(c2);
  const ctx = await pineTS.run(`//@version=6
strategy("P22", overlay=true, default_qty_type=strategy.fixed, default_qty_value=1)
if bar_index == 5
    strategy.entry("L1", strategy.long, limit=1995)
`);
  const t = ctx.strategy.closedtrades[0];
  console.log('P22 fill:', t ? { price: t.entry_price, bar: t.entry_bar_index } : 'NO FILL');
}

// P23: entry fill + TP kena di bar yang sama
{
  const c3 = candles.map((c, i) => (i === 10 ? { ...c, open: 2000, high: 2030, low: 1994, close: 2025 } : c));
  const pineTS = new PineTS(c3);
  const ctx = await pineTS.run(`//@version=6
strategy("P23", overlay=true, default_qty_type=strategy.fixed, default_qty_value=1)
if bar_index == 5
    strategy.entry("L1", strategy.long, limit=1995)
if bar_index == 5
    strategy.exit("X1", from_entry="L1", stop=1980, limit=2020)
`);
  const s = ctx.strategy;
  console.log('P23 closed:', s.closedtrades.map(t => ({ exit_price: t.exit_price, exit_bar: t.exit_bar_index })), 'open:', s.opentrades.length);
}

// P24: dua alert() di bar sama + posisi event
{
  const pineTS = new PineTS(candles.slice(0, 4));
  pineTS.setAlertMode('all');
  const ctx = await pineTS.run(`//@version=6
indicator("P24")
if bar_index == 2
    alert('{"e":1}', alert.freq_once_per_bar)
    alert('{"e":2}', alert.freq_once_per_bar)
`);
  console.log('P24 alerts:', JSON.stringify(ctx.alerts.map(a => ({ m: a.message, t: a.time }))));
}
console.log('PROBE3 DONE');
