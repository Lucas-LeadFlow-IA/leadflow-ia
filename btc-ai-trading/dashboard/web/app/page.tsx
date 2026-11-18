"use client";

import { usePoll } from "@/lib/api";
import { pct, pf, regimeLabel, signedUsd, strategyLabel, time, tone, usd } from "@/lib/format";
import { Card, Empty, ErrorNote, KV, Pill, Stat } from "@/components/ui";
import { EquityChart } from "@/components/charts";

export default function Overview() {
  const { data: d, error } = usePoll<any>("/api/overview", 5000);
  const sig = d?.last_signal;
  const pos = d?.position;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Vue d'ensemble</h1>
          <p className="text-sm text-muted">
            Régime <b className="text-ink">{regimeLabel[d?.regime] ?? "…"}</b> · stratégie active{" "}
            <b className="text-ink">{strategyLabel[d?.active_strategy] ?? "…"}</b>
          </p>
        </div>
        <Pill kind="neutral">Capital de référence {usd(d?.initial_capital, 0)}</Pill>
      </div>
      <ErrorNote error={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Capital (solde)" value={usd(d?.capital)} />
        <Stat label="Equity" value={usd(d?.equity)} sub={`Latent ${signedUsd(d?.unrealized_pnl)}`} />
        <Stat label="P&L du jour" value={signedUsd(d?.pnl_today)} valueClass={tone(d?.pnl_today)} />
        <Stat label="P&L total" value={signedUsd(d?.pnl_total)} valueClass={tone(d?.pnl_total)} />
        <Stat label="Drawdown" value={pct(d?.drawdown_pct)} valueClass={(d?.drawdown_pct ?? 0) > 5 ? "text-warn" : ""} sub="depuis le plus haut" />
        <Stat label="Win rate" value={pct(d?.win_rate, 1, true)} sub="jamais un critère seul" />
        <Stat label="Profit factor" value={pf(d?.profit_factor)} sub={`Espérance ${signedUsd(d?.expectancy_usd)}`} />
        <Stat label="Trades" value={d?.trades ?? "–"} sub={`Frais ${usd(d?.fees)} · funding ${usd(d?.funding)}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Courbe d'equity" className="lg:col-span-2">
          {d?.equity_curve?.length > 1 ? <EquityChart points={d.equity_curve} /> : <Empty>La courbe apparaît après quelques minutes de fonctionnement.</Empty>}
        </Card>
        <Card title="Position ouverte">
          {pos ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Pill kind={pos.direction === "LONG" ? "good" : "bad"}>{pos.direction}</Pill>
                <span className="num text-sm">{pos.size} BTC @ {usd(pos.entry_price, 1)}</span>
              </div>
              <KV k="Stop-loss" v={usd(pos.stop_loss, 1)} />
              <KV k="Take-profit" v={usd(pos.take_profit, 1)} />
              <KV k="Risque initial" v={usd(pos.risk_usd)} />
              <KV k="Stratégie / régime" v={`${strategyLabel[pos.strategy]} · ${regimeLabel[pos.regime]}`} />
              <KV k="Ouverte" v={time(pos.opened_at)} />
            </div>
          ) : (
            <Empty>Aucune position. Une seule position simultanée est autorisée.</Empty>
          )}
        </Card>
      </div>

      <Card title="Dernière décision" right={sig ? <span className="text-xs text-muted">{time(sig.timestamp)}</span> : null}>
        {sig ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Pill kind={sig.direction === "LONG" ? "good" : sig.direction === "SHORT" ? "bad" : "neutral"}>{sig.direction.replace("_", " ")}</Pill>
                <Pill kind="neutral">{strategyLabel[sig.strategy] ?? sig.strategy}</Pill>
                <Pill kind="neutral">{regimeLabel[sig.regime] ?? sig.regime}</Pill>
                {sig.confidence && (
                  <Pill kind="info">
                    Score {Math.round(sig.confidence.raw_score)}
                    {sig.confidence.calibrated ? ` · p=${(sig.confidence.probability * 100).toFixed(0)}%` : " · non calibré"}
                  </Pill>
                )}
              </div>
              <p className="text-sm text-muted">{sig.strategy_rationale}</p>
              {sig.entry_price && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <KV k="Entrée" v={usd(sig.entry_price, 0)} />
                  <KV k="SL" v={usd(sig.stop_loss, 0)} />
                  <KV k="TP" v={usd(sig.take_profit, 0)} />
                </div>
              )}
              {sig.risk && <p className="num mt-2 text-xs text-muted">Taille {sig.size} BTC · risque {usd(sig.risk_usd)} · coût estimé {usd(sig.est_cost_usd)}</p>}
            </div>
            <div>
              <div className="label mb-1.5">Raisons</div>
              <ul className="space-y-1 text-sm text-muted">
                {(sig.reasons ?? []).slice(0, 6).map((r: string, i: number) => (
                  <li key={i} className="flex gap-2"><span className="text-faint">›</span>{r}</li>
                ))}
              </ul>
              {sig.invalidations?.length > 0 && (
                <>
                  <div className="label mb-1.5 mt-3">Invalidation du scénario</div>
                  <ul className="space-y-1 text-sm text-muted">
                    {sig.invalidations.map((r: string, i: number) => <li key={i} className="flex gap-2"><span className="text-faint">×</span>{r}</li>)}
                  </ul>
                </>
              )}
            </div>
          </div>
        ) : (
          <Empty>En attente du premier cycle de décision.</Empty>
        )}
      </Card>
      <p className="text-xs text-faint">{d?.targets_note}</p>
    </div>
  );
}
