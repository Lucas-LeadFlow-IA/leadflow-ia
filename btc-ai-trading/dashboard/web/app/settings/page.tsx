"use client";

import { useState } from "react";
import { apiPost, usePoll } from "@/lib/api";
import { num, pf, strategyLabel, usd } from "@/lib/format";
import { Card, ErrorNote, KV, Pill } from "@/components/ui";

export default function Settings() {
  const { data: s, error, refresh } = usePoll<any>("/api/settings", 10000);
  const { data: bt } = usePoll<any>("/api/backtests", 60000);
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (path: string, body?: unknown) => {
    try {
      const r: any = await apiPost(path, body);
      setMsg(`OK : ${JSON.stringify(r.state ?? r.requested_mode ?? r)}`);
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };
  const runs: any[] = bt?.latest ?? [];
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Paramètres</h1>
      <ErrorNote error={error} />
      {msg && <div className="rounded-xl border border-line bg-raised px-3 py-2 text-sm">{msg}</div>}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Environnement">
          <KV k="Mode actif" v={<Pill kind={s?.mode === "live" ? "bad" : s?.mode === "testnet" ? "warn" : "info"}>{s?.mode?.toUpperCase() ?? "…"}</Pill>} />
          <KV k="Données marché" v={<span className="text-xs">{s?.market_data_url}</span>} />
          <KV k="Exécution signée" v={<span className="text-xs">{s?.execution_url ?? "aucune (paper)"}</span>} />
          <KV k="Compte" v={<span className="text-xs">{s?.account_address ?? "–"}</span>} />
          <KV k="Telegram" v={s?.telegram_enabled ? "activé" : "désactivé"} />
          <div className="mt-4">
            <div className="label mb-2">Mode au prochain redémarrage</div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => act("/api/settings/mode-request", { mode: "paper" })}>PAPER</button>
              <button className="btn-ghost flex-1" onClick={() => act("/api/settings/mode-request", { mode: "testnet" })}>TESTNET</button>
            </div>
            {s?.mode_request && <p className="mt-2 text-xs text-muted">Demande enregistrée : {s.mode_request.requested_mode.toUpperCase()} — à appliquer via TRADING_MODE puis redémarrage.</p>}
            <p className="mt-2 text-xs text-faint">{s?.live_note}</p>
          </div>
        </Card>
        <Card title="Contrôles">
          <p className="mb-3 text-sm text-muted">La pause bloque les nouvelles entrées ; les positions restent protégées par leur stop-loss sur l'exchange.</p>
          <div className="flex flex-col gap-2">
            <button className="btn-ghost" onClick={() => act("/api/control/pause")}>⏸ Mettre en pause</button>
            <button className="btn-ghost" onClick={() => act("/api/control/resume")}>▶ Reprendre (si en pause)</button>
          </div>
          <p className="mt-3 text-xs text-muted">Arrêt d'urgence : bouton rouge en haut de page. Après un arrêt (HALTED), seule la commande <code>python main.py kill-switch reset</code> réactive le trading.</p>
          <div className="mt-4">
            <KV k="Politique d'urgence" v={s?.emergency_position_policy} />
            <KV k="Intervalle de décision" v={`${s?.decision_interval_seconds ?? "–"} s`} />
            <KV k="Score minimum" v={s?.min_setup_score} />
          </div>
        </Card>
        <Card title="Stratégies & coûts">
          <div className="mb-3 flex flex-wrap gap-1.5">{(s?.enabled_strategies ?? []).map((x: string) => <Pill key={x} kind="neutral">{strategyLabel[x] ?? x}</Pill>)}</div>
          <KV k="Frais taker / maker" v={`${num((s?.costs?.taker_fee ?? 0) * 100, 3)} % / ${num((s?.costs?.maker_fee ?? 0) * 100, 3)} %`} />
          <KV k="Slippage marché / stop" v={`${s?.costs?.slippage_bps_market} / ${s?.costs?.slippage_bps_stop} bps`} />
          <p className="mt-3 text-xs text-muted">Modification des stratégies et des limites : uniquement via .env + redémarrage, après nouveaux backtests. Les limites ne peuvent jamais dépasser les plafonds codés.</p>
        </Card>
      </div>

      <Card title="Dernière comparaison de backtests" right={<span className="text-xs text-muted">reports/latest.json</span>}>
        {runs.length ? (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Run</th><th>Période</th><th>Trades</th><th>Win rate</th><th>PF</th><th>Espérance</th><th>Net</th><th>DD max</th><th>Validé</th></tr></thead>
              <tbody>
                {runs.map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="font-medium">{r.label}</td>
                    <td className="whitespace-nowrap text-xs text-muted">{r.period.from.slice(0, 10)} → {r.period.to.slice(0, 10)}</td>
                    <td className="num">{r.trade_metrics.trades}</td>
                    <td className="num">{r.trade_metrics.win_rate === null ? "–" : `${num(r.trade_metrics.win_rate * 100, 1)} %`}</td>
                    <td className="num">{pf(r.trade_metrics.profit_factor)}</td>
                    <td className="num">{usd(r.trade_metrics.expectancy_usd)}</td>
                    <td className="num">{usd(r.trade_metrics.net_pnl)}</td>
                    <td className="num">{num(r.equity_metrics.max_drawdown_pct, 2)} %</td>
                    <td><Pill kind={r.validation.passed ? "good" : "bad"}>{r.validation.passed ? "oui" : "non"}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">Aucun rapport. Lancez <code>python main.py backtest</code>.</p>
        )}
      </Card>
    </div>
  );
}
