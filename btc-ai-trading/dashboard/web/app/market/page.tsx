"use client";

import { useState } from "react";
import { usePoll } from "@/lib/api";
import { num, pct, regimeLabel, strategyLabel, time, usd } from "@/lib/format";
import { Card, Empty, ErrorNote, KV, Pill } from "@/components/ui";
import { PriceChart } from "@/components/charts";

const TFS = ["1m", "5m", "15m", "1h", "4h"];

export default function Market() {
  const [tf, setTf] = useState("15m");
  const { data: m, error } = usePoll<any>("/api/market", 4000);
  const { data: candles } = usePoll<any[]>(`/api/candles?tf=${tf}&limit=300`, 10000);
  const change = m?.price && m?.prev_day_px ? (m.price / m.prev_day_px - 1) * 100 : null;
  const scanTfs = m?.scan?.timeframes ?? {};
  const techTfs = m?.technical?.timeframes ?? {};
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label">BTC-PERP · Hyperliquid</div>
          <div className="num mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{usd(m?.price, 1)}</div>
          <div className="num mt-1 text-sm">
            <span className={change === null ? "text-muted" : change >= 0 ? "text-good" : "text-bad"}>
              {change === null ? "–" : `${change >= 0 ? "▲ +" : "▼ "}${num(change, 2)} % 24h`}
            </span>
            <span className="ml-3 text-muted">Mark {usd(m?.mark, 0)} · Funding {pct((m?.funding_rate_hourly ?? 0) * 100, 4)}/h</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill kind="accent">{regimeLabel[m?.regime?.regime] ?? "…"}</Pill>
          <Pill kind="neutral">Stratégie : {strategyLabel[m?.strategy?.active_strategy] ?? "…"}</Pill>
          <Pill kind={m?.scan?.volatility_state === "high" ? "warn" : "neutral"}>Volatilité {m?.scan?.volatility_state ?? "…"}</Pill>
        </div>
      </div>
      <ErrorNote error={error} />

      <Card
        title="Graphique"
        right={
          <div className="flex gap-1 rounded-xl border border-line bg-raised p-1" role="tablist" aria-label="Unité de temps">
            {TFS.map((t) => (
              <button key={t} role="tab" aria-selected={tf === t} onClick={() => setTf(t)} className={`rounded-lg px-2.5 py-1 text-xs ${tf === t ? "bg-surface text-ink" : "text-muted hover:text-ink"}`}>
                {t}
              </button>
            ))}
          </div>
        }
      >
        {candles?.length ? <PriceChart candles={candles} /> : <Empty>Chargement des bougies…</Empty>}
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Tendance multi-timeframe" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>TF</th><th>Biais technique</th><th>RSI</th><th>ADX</th><th>ATR %</th><th>Rang ATR</th><th>Volume z</th></tr>
              </thead>
              <tbody>
                {Object.keys(techTfs).map((k) => {
                  const t = techTfs[k];
                  const sc = scanTfs[k] ?? {};
                  return (
                    <tr key={k}>
                      <td className="font-medium">{k}</td>
                      <td><Pill kind={t.bias > 0 ? "good" : t.bias < 0 ? "bad" : "neutral"}>{t.bias > 0 ? "Haussier" : t.bias < 0 ? "Baissier" : "Neutre"}</Pill></td>
                      <td className="num">{num(t.rsi, 1)}</td>
                      <td className="num">{num(t.adx, 1)}</td>
                      <td className="num">{num(sc.atr_pct, 3)}</td>
                      <td className="num">{sc.atr_rank === null || sc.atr_rank === undefined ? "–" : `${Math.round(sc.atr_rank * 100)}e`}</td>
                      <td className="num">{num(sc.vol_z, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">Biais = accord d'au moins 3 groupes de facteurs indépendants (tendance, structure, momentum, position, force). Aucun indicateur isolé ne suffit.</p>
        </Card>
        <Card title="Régime de marché">
          <div className="mb-2 text-lg font-semibold">{regimeLabel[m?.regime?.regime] ?? "…"}</div>
          <ul className="space-y-1 text-sm text-muted">
            {(m?.regime?.reasons ?? []).map((r: string, i: number) => <li key={i}>› {r}</li>)}
          </ul>
          <div className="mt-3">
            <KV k="Régime brut (avant hystérésis)" v={regimeLabel[m?.regime?.raw_regime] ?? "–"} />
            <KV k="Changement en attente" v={m?.regime?.pending_change ? `${regimeLabel[m.regime.pending_change]} (${m.regime.pending_count})` : "–"} />
            <KV k="NO TRADE imposé" v={m?.regime?.no_trade ? "oui" : "non"} />
            <KV k="Spread" v={m?.book ? `${num(m.book.spread_bps, 2)} bps` : "–"} />
            <KV k="Déséquilibre carnet (10 bps)" v={m?.book ? num(m.book.imbalance_10bps, 2) : "–"} />
          </div>
        </Card>
      </div>

      <Card title="Moteur stratégique & signaux détectés">
        <p className="mb-3 text-sm text-muted">{m?.strategy?.rationale}</p>
        {m?.strategy?.rejections?.length > 0 && (
          <details className="mb-3 text-sm">
            <summary className="cursor-pointer text-muted">Conditions non remplies ({m.strategy.rejections.length})</summary>
            <ul className="mt-2 space-y-1 text-muted">{m.strategy.rejections.map((r: string, i: number) => <li key={i}>› {r}</li>)}</ul>
          </details>
        )}
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Heure</th><th>Décision</th><th>Stratégie</th><th>Régime</th><th>Score</th><th>Risk</th></tr></thead>
            <tbody>
              {(m?.signals ?? []).slice(0, 15).map((s: any, i: number) => (
                <tr key={i}>
                  <td className="num whitespace-nowrap text-muted">{time(s.ts)}</td>
                  <td><Pill kind={s.direction === "LONG" ? "good" : s.direction === "SHORT" ? "bad" : "neutral"}>{s.direction.replace("_", " ")}</Pill></td>
                  <td>{strategyLabel[s.strategy] ?? s.strategy}</td>
                  <td className="text-muted">{regimeLabel[s.regime] ?? s.regime}</td>
                  <td className="num">{s.score === null ? "–" : Math.round(s.score)}</td>
                  <td>{s.score === null ? "–" : <Pill kind={s.approved ? "good" : "warn"}>{s.approved ? "approuvé" : "veto"}</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
