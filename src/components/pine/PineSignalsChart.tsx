'use client';

/**
 * PineSignalsChart — chart candle + sinyal Pine untuk dashboard Luxtradee.
 *
 * MEMAKAI API LIGHTWEIGHT-CHARTS v5 (BUKAN v4):
 *  - chart.addSeries(CandlestickSeries, {...})          (bukan addCandlestickSeries)
 *  - createSeriesMarkers(series, markers)               (bukan series.setMarkers)
 *  - multi-pane lewat argumen paneIndex addSeries(..., paneIndex)
 *  - garis level entry/SL/TP lewat series.createPriceLine
 *
 * Waktu memakai DETIK UTC (kontrak v5); candle belum close tidak memicu marker.
 */
import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  createSeriesMarkers,
  ColorType,
  LineStyle,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
} from 'lightweight-charts';

export interface ChartCandle {
  time: number; // ms UTC waktu OPEN
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartEvent {
  event: string;
  candleTime: number; // ms UTC
  side?: 'BUY' | 'SELL' | null;
  entry?: number;
  sl?: number;
  tp?: number;
  reason?: string;
}

export interface ChartPlot {
  name: string;
  data: { time: number; value: number | null }[];
}

interface Props {
  candles: ChartCandle[];
  events: ChartEvent[];
  plots?: ChartPlot[];
  sourceLabel?: string;
  height?: number;
}

const UP = '#26a69a';
const DOWN = '#ef5350';

export default function PineSignalsChart({ candles, events, plots = [], sourceLabel, height = 460 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const paneSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const markersApiRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  // init sekali
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0f17' },
        textColor: '#94a3b8',
        fontSize: 11,
        panes: { separatorColor: '#1e293b', separatorHoverColor: '#334155' },
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.06)' },
        horzLines: { color: 'rgba(148,163,184,0.06)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(148,163,184,0.2)' },
      timeScale: {
        borderColor: 'rgba(148,163,184,0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
      autoSize: true,
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
    });
    candleSeriesRef.current = candleSeries;
    // v5: marker dibuat SEKALI, update lewat setMarkers (jangan menumpuk primitive)
    markersApiRef.current = createSeriesMarkers(candleSeries, []);

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      priceLinesRef.current = [];
      paneSeriesRef.current = [];
      markersApiRef.current = null;
    };
  }, [height]);

  // data candle + markers + price lines
  useEffect(() => {
    const series = candleSeriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    // dobel-jaga: candle belum close TIDAK boleh tampil/memicu marker
    const lastClosed = Math.floor(Date.now() / 3_600_000) * 3_600_000 - 3_600_000;
    const data = candles
      .filter((c) => c.time <= lastClosed)
      .map((c) => ({
        time: Math.floor(c.time / 1000) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
    series.setData(data);

    const lastClosedSec = Math.floor(lastClosed / 1000);
    const markers: SeriesMarker<Time>[] = [];
    for (const ev of events) {
      const t = Math.floor(ev.candleTime / 1000);
      if (t > lastClosedSec) continue;
      if (ev.event === 'PLACE_LIMIT' || ev.event === 'REPLACE_LIMIT' || ev.event === 'SIGNAL') {
        const buy = ev.side === 'BUY';
        markers.push({
          time: t as Time,
          position: buy ? 'belowBar' : 'aboveBar',
          color: buy ? UP : DOWN,
          shape: buy ? 'arrowUp' : 'arrowDown',
          text: ev.event === 'SIGNAL' ? ev.side || '' : `${ev.event === 'REPLACE_LIMIT' ? 'R' : ''}${ev.side || ''}`,
          size: 1,
        });
      } else if (ev.event === 'CANCEL_PENDING') {
        markers.push({
          time: t as Time,
          position: 'aboveBar',
          color: '#94a3b8',
          shape: 'circle',
          text: 'X',
          size: 0.5,
        });
      } else if (ev.event === 'CLOSE_POSITION') {
        markers.push({
          time: t as Time,
          position: 'belowBar',
          color: '#f59e0b',
          shape: 'square',
          text: 'C',
          size: 0.5,
        });
      }
    }
    markers.sort((a, b) => Number(a.time) - Number(b.time));
    if (markersApiRef.current) {
      markersApiRef.current.setMarkers(markers);
    } else {
      createSeriesMarkers(series, markers);
      markersApiRef.current = createSeriesMarkers(series, []);
    }

    // garis level order aktif terakhir (entry/SL/TP)
    for (const line of priceLinesRef.current) {
      try { series.removePriceLine(line); } catch { /* noop */ }
    }
    priceLinesRef.current = [];
    let active: ChartEvent | null = null;
    for (const ev of events) {
      if (ev.event === 'PLACE_LIMIT' || ev.event === 'REPLACE_LIMIT') active = ev;
      else if (ev.event === 'CANCEL_PENDING' || ev.event === 'CLOSE_POSITION') active = null;
    }
    if (active && typeof active.entry === 'number') {
      const lines = [
        { price: active.entry, color: '#e2e8f0', title: 'ENTRY', style: LineStyle.Solid },
        { price: active.sl, color: DOWN, title: 'SL', style: LineStyle.Dashed },
        { price: active.tp, color: UP, title: 'TP', style: LineStyle.Dashed },
      ];
      for (const l of lines) {
        if (typeof l.price !== 'number' || !Number.isFinite(l.price)) continue;
        priceLinesRef.current.push(
          series.createPriceLine({
            price: l.price,
            color: l.color,
            lineWidth: 1,
            lineStyle: l.style,
            axisLabelVisible: true,
            title: l.title,
          })
        );
      }
    }

    try { chart.timeScale().fitContent(); } catch { /* noop */ }
  }, [candles, events]);

  // plot output Pine (mis. ADX) di pane terpisah (multi-pane v5)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    for (const s of paneSeriesRef.current) {
      try { chart.removeSeries(s); } catch { /* noop */ }
    }
    paneSeriesRef.current = [];
    const colors = ['#f59e0b', '#14b8a6', '#f472b6', '#a78bfa'];
    plots.slice(0, 4).forEach((plot, idx) => {
      const series = chart.addSeries(
        LineSeries,
        { color: colors[idx % colors.length], lineWidth: 2, priceLineVisible: false, lastValueVisible: false },
        1 // pane index 1 (di bawah candle)
      );
      const data = plot.data
        .filter((d) => d && typeof d.time === 'number' && d.value !== null && Number.isFinite(d.value as number))
        .map((d) => ({ time: Math.floor(d.time / 1000) as Time, value: d.value as number }));
      series.setData(data);
      paneSeriesRef.current.push(series);
    });
    try { chartRef.current?.timeScale().fitContent(); } catch { /* noop */ }
  }, [plots]);

  return (
    <div className="relative w-full" style={{ minHeight: height }}>
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden border border-white/10" style={{ height }} />
      {sourceLabel && (
        <div className="absolute top-2 left-2 z-10 pointer-events-none rounded bg-black/60 backdrop-blur px-2 py-1 text-[10px] text-slate-300 border border-white/10">
          {sourceLabel}
        </div>
      )}
    </div>
  );
}
