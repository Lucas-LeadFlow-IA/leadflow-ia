export const usd = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || Number.isNaN(v)
    ? "–"
    : v.toLocaleString("fr-FR", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

export const signedUsd = (v: number | null | undefined) =>
  v === null || v === undefined ? "–" : `${v > 0 ? "+" : ""}${usd(v)}`;

export const num = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? "–"
    : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pct = (v: number | null | undefined, digits = 2, ratio = false) =>
  v === null || v === undefined ? "–" : `${num(ratio ? v * 100 : v, digits)} %`;

export const pf = (v: number | string | null | undefined) =>
  v === null || v === undefined ? "–" : v === "inf" ? "∞" : num(Number(v), 2);

export const time = (ms: number | null | undefined) =>
  !ms ? "–" : new Date(ms).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const ago = (ms: number | null | undefined) => {
  if (!ms) return "–";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `il y a ${s}s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  return `il y a ${Math.round(s / 3600)} h`;
};

export const tone = (v: number | null | undefined) => (v === null || v === undefined || v === 0 ? "text-ink" : v > 0 ? "text-good" : "text-bad");

export const regimeLabel: Record<string, string> = {
  strong_bullish_trend: "Tendance haussière forte",
  strong_bearish_trend: "Tendance baissière forte",
  sideways: "Range / latéral",
  high_volatility: "Volatilité élevée",
  low_volatility: "Volatilité faible",
  unstable: "Instable",
  news_driven: "News / choc",
  unknown: "Transition",
};

export const strategyLabel: Record<string, string> = {
  scalping: "Scalping",
  intraday: "Intraday",
  trend_following: "Trend following",
  range_trading: "Range trading",
  none: "Aucune",
};
