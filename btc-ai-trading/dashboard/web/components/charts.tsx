"use client";

import { useEffect, useRef, useState } from "react";
import { ColorType, CrosshairMode, createChart, type IChartApi, type UTCTimestamp } from "lightweight-charts";

const CSS = (name: string, fallback: string) =>
  typeof window === "undefined" ? fallback : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function baseOptions() {
  return {
    autoSize: true,
    layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: CSS("--muted", "#9aa7b8"), fontSize: 11 },
    grid: { vertLines: { color: "rgba(31,41,55,0.35)" }, horzLines: { color: "rgba(31,41,55,0.35)" } },
    rightPriceScale: { borderColor: CSS("--line", "#1f2937") },
    timeScale: { borderColor: CSS("--line", "#1f2937"), timeVisible: true, secondsVisible: false },
    crosshair: { mode: CrosshairMode.Normal },
    localization: { locale: "fr-FR" },
  };
}

export type Candle = { open_time: number; open: number; high: number; low: number; close: number; ema20?: number | null; ema50?: number | null; ema200?: number | null; vwap?: number | null };

const SERIES = [
  { key: "ema20", label: "EMA 20", color: "--s1", fb: "#3987e5" },
  { key: "ema50", label: "EMA 50", color: "--s2", fb: "#d95926" },
  { key: "ema200", label: "EMA 200", color: "--s3", fb: "#199e70" },
  { key: "vwap", label: "VWAP", color: "--s4", fb: "#c98500" },
] as const;

/** Candlesticks + EMA20/50/200 + VWAP. Legend doubles as the crosshair readout. */
export function PriceChart({ candles, height = 380 }: { candles: Candle[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>({});
  const [hover, setHover] = useState<Record<string, number | null> | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, { ...baseOptions(), height });
    chartRef.current = chart;
    const good = CSS("--good", "#0ca30c");
    const bad = CSS("--bad", "#d03b3b");
    seriesRef.current.candles = chart.addCandlestickSeries({ upColor: good, downColor: bad, borderVisible: false, wickUpColor: good, wickDownColor: bad });
    for (const s of SERIES) {
      seriesRef.current[s.key] = chart.addLineSeries({ color: CSS(s.color, s.fb), lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    }
    chart.subscribeCrosshairMove((p) => {
      if (!p.time || !p.seriesData) return setHover(null);
      const c: any = p.seriesData.get(seriesRef.current.candles);
      const out: Record<string, number | null> = { open: c?.open ?? null, high: c?.high ?? null, low: c?.low ?? null, close: c?.close ?? null };
      for (const s of SERIES) out[s.key] = (p.seriesData.get(seriesRef.current[s.key]) as any)?.value ?? null;
      setHover(out);
    });
    return () => chart.remove();
  }, [height]);

  useEffect(() => {
    const s = seriesRef.current;
    if (!s.candles || !candles?.length) return;
    s.candles.setData(candles.map((c) => ({ time: (c.open_time / 1000) as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
    for (const def of SERIES) {
      s[def.key].setData(
        candles.filter((c) => c[def.key] !== null && c[def.key] !== undefined).map((c) => ({ time: (c.open_time / 1000) as UTCTimestamp, value: c[def.key] as number })),
      );
    }
  }, [candles]);

  const last = candles?.[candles.length - 1];
  const shown = hover ?? (last ? { open: last.open, high: last.high, low: last.low, close: last.close, ema20: last.ema20 ?? null, ema50: last.ema50 ?? null, ema200: last.ema200 ?? null, vwap: last.vwap ?? null } : null);
  const f = (v: number | null | undefined) => (v === null || v === undefined ? "–" : v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }));
  return (
    <div className="relative">
      <div className="num mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-live="polite">
        {shown && (
          <span>
            O <b className="text-ink">{f(shown.open)}</b> H <b className="text-ink">{f(shown.high)}</b> L <b className="text-ink">{f(shown.low)}</b> C <b className="text-ink">{f(shown.close)}</b>
          </span>
        )}
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: `var(${s.color})` }} />
            {s.label} <b className="text-ink">{f(shown?.[s.key])}</b>
          </span>
        ))}
      </div>
      <div ref={ref} style={{ height }} className="w-full" role="img" aria-label="Graphique BTC en chandeliers avec EMA 20, 50, 200 et VWAP" />
    </div>
  );
}

/** Single-series equity curve (area). The title names the series: no legend box. */
export function EquityChart({ points, height = 220 }: { points: { ts: number; equity: number }[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<any>(null);
  const [hover, setHover] = useState<{ t: number; v: number } | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, { ...baseOptions(), height });
    const blue = CSS("--s1", "#3987e5");
    seriesRef.current = chart.addAreaSeries({ lineColor: blue, topColor: "rgba(57,135,229,0.28)", bottomColor: "rgba(57,135,229,0.02)", lineWidth: 2, priceLineVisible: false });
    chart.subscribeCrosshairMove((p) => {
      const d: any = p.time && p.seriesData ? p.seriesData.get(seriesRef.current) : null;
      setHover(d ? { t: (p.time as number) * 1000, v: d.value } : null);
    });
    return () => chart.remove();
  }, [height]);
  useEffect(() => {
    if (!seriesRef.current) return;
    const seen = new Set<number>();
    const data = points
      .map((p) => ({ time: Math.floor(p.ts / 1000) as UTCTimestamp, value: p.equity }))
      .filter((p) => (seen.has(p.time) ? false : (seen.add(p.time), true)));
    seriesRef.current.setData(data);
  }, [points]);
  return (
    <div>
      <div className="num mb-1 h-4 text-xs text-muted">
        {hover ? `${new Date(hover.t).toLocaleString("fr-FR")} — ${hover.v.toLocaleString("fr-FR", { style: "currency", currency: "USD" })}` : ""}
      </div>
      <div ref={ref} style={{ height }} className="w-full" role="img" aria-label="Courbe d'equity" />
    </div>
  );
}
