"use client";

import { usePoll } from "@/lib/api";
import { num, signedUsd, time, usd } from "@/lib/format";
import { Card, Empty, ErrorNote, KV, Meter, Pill, statusKind } from "@/components/ui";

export default function Risk() {
  const { data, error } = usePoll<any>("/api/risk", 5000);
  const r = data?.status;
  const L = r?.limits;
  const h = data?.health;
  const v = data?.last_verdict;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Risk Manager</h1>
        <Pill kind={statusKind(r?.kill_switch?.state)}>Kill switch : {r?.kill_switch?.state ?? "…"}</Pill>
      </div>
      <ErrorNote error={error} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Utilisation des limites">
          {r ? (
            <div className="space-y-4">
              <Meter label="Perte du jour (%)" value={r.daily_loss_pct} max={L.max_daily_loss_pct} />
              <Meter label="Drawdown depuis le sommet (%)" value={r.drawdown_pct} max={L.max_drawdown_pct} />
              <Meter label="Pertes consécutives" value={r.consecutive_losses} max={L.max_consecutive_losses} />
              <p className="text-xs text-muted">Vert &lt; 60 % · orange &lt; 90 % · rouge ≥ 90 % de la limite.</p>
            </div>
          ) : <Empty>…</Empty>}
        </Card>
        <Card title="Limites (lecture seule)">
          {L && (
            <>
              <KV k="Risque max / trade" v={`${L.risk_per_trade_pct} % (${usd(r.risk_per_trade_usd)})`} />
              <KV k="Perte journalière max" v={`${L.max_daily_loss_pct} % (${usd(r.daily_loss_limit_usd)})`} />
              <KV k="Drawdown max" v={`${L.max_drawdown_pct} %`} />
              <KV k="Levier max" v={`${L.max_leverage}x`} />
              <KV k="Positions simultanées" v={L.max_open_positions} />
              <KV k="Marge" v={L.margin_mode} />
              <KV k="R/R min après coûts" v={L.min_reward_risk} />
              <p className="mt-2 text-xs text-muted">Plafonds codés en dur dans risk/limits.py : aucun agent, dashboard ou Telegram ne peut les dépasser.</p>
            </>
          )}
        </Card>
        <Card title="État du compte">
          {r && (
            <>
              <KV k="Equity" v={usd(r.equity)} />
              <KV k="Plus haut d'equity" v={usd(r.peak_equity)} />
              <KV k="Equity début de journée (UTC)" v={usd(r.day_start_equity)} />
              <KV k="P&L du jour" v={signedUsd(r.daily_pnl)} />
              <KV k="Trades aujourd'hui" v={r.trades_today} />
              <KV k="Verrou journalier" v={r.daily_locked ? "ACTIF" : "non"} />
              <KV k="Pause après pertes" v={r.cooldown_until_ms > Date.now() ? `jusqu'à ${time(r.cooldown_until_ms)}` : "non"} />
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Santé du système (coupe-circuits)">
          {h && (
            <>
              <KV k="Âge des données marché" v={<Pill kind={h.data_age_s > h.max_data_age_s / 3 ? "warn" : "good"}>{num(h.data_age_s, 1)} s</Pill>} />
              <KV k="WebSocket" v={<Pill kind={h.ws_connected ? "good" : "bad"}>{h.ws_connected ? "connecté" : "déconnecté"}</Pill>} />
              <KV k="Déconnexions (10 min)" v={h.ws_disconnects_10min} />
              <KV k="Échecs REST consécutifs" v={h.rest_failures} />
              <KV k="Synchro compte" v={`${num(h.account_sync_age_s, 1)} s`} />
              <KV k="Désynchronisation" v={<Pill kind={h.desync ? "bad" : "good"}>{h.desync ? h.desync_detail : "aucune"}</Pill>} />
              <KV k="Erreurs d'exécution (10 min)" v={h.execution_errors_10min} />
              <KV k="Spread" v={h.spread_bps === null ? "–" : `${num(h.spread_bps, 2)} bps`} />
            </>
          )}
        </Card>
        <Card title="Dernier verdict du Risk Manager">
          {v ? (
            <>
              <div className="mb-2"><Pill kind={v.approved ? "good" : "warn"}>{v.approved ? "APPROUVÉ" : "VETO"}</Pill></div>
              <ul className="mb-3 space-y-1 text-sm text-muted">{(v.reasons ?? []).map((x: string, i: number) => <li key={i}>› {x}</li>)}</ul>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(v.checks ?? {}).map(([k, ok]) => <Pill key={k} kind={ok ? "good" : "bad"}>{k}</Pill>)}
              </div>
            </>
          ) : <Empty>Aucun setup soumis au Risk Manager pour l'instant.</Empty>}
        </Card>
      </div>

      <Card title="Événements kill switch & risque">
        {r?.kill_switch?.events?.length || data?.events?.length ? (
          <ul className="space-y-1.5 text-sm">
            {(r?.kill_switch?.events ?? []).slice().reverse().map((e: any, i: number) => (
              <li key={`k${i}`} className="flex gap-3"><span className="num text-muted">{time(e.ts)}</span><Pill kind={statusKind(e.to)}>{e.from} → {e.to}</Pill><span className="text-muted">{e.reason} ({e.source})</span></li>
            ))}
            {(data?.events ?? []).filter((e: any) => e.level !== "info").slice(0, 20).map((e: any, i: number) => (
              <li key={`e${i}`} className="flex gap-3"><span className="num text-muted">{time(e.ts)}</span><Pill kind={e.level === "error" ? "bad" : "warn"}>{e.kind}</Pill><span className="text-muted">{e.message}</span></li>
            ))}
          </ul>
        ) : <Empty>Aucun événement.</Empty>}
      </Card>
    </div>
  );
}
