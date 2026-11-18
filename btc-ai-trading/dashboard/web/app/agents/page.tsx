"use client";

import { usePoll } from "@/lib/api";
import { ago, regimeLabel, strategyLabel, time } from "@/lib/format";
import { Card, Empty, ErrorNote, Pill, statusKind } from "@/components/ui";

const TITLES: Record<string, string> = {
  market_scanner: "1 · Market Scanner",
  technical_analyst: "2 · Technical Analyst",
  liquidity_analyst: "3 · Liquidity Analyst",
  regime_detector: "4 · Market Regime",
  strategy_engine: "5 · Adaptive Strategy Engine",
  risk_manager: "6 · Risk Manager (veto)",
  execution_agent: "7 · Execution Agent",
  performance_analyst: "8 · Performance Analyst",
};

export default function Agents() {
  const { data, error } = usePoll<any>("/api/agents", 5000);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Agents</h1>
        <p className="text-sm text-muted">Pipeline : scanner → technique → liquidité → régime → stratégie → risque → exécution → performance.</p>
      </div>
      <ErrorNote error={error} />
      <div className="flex flex-wrap gap-2 text-xs">
        <Pill kind={data?.ml?.anomaly_model ? "good" : "neutral"}>Détection d'anomalies {data?.ml?.anomaly_model ? "active" : "inactive"}</Pill>
        <Pill kind={data?.ml?.trade_filter ? "good" : "neutral"}>Filtre ML {data?.ml?.trade_filter ? "actif" : "inactif (non validé OOS)"}</Pill>
        <Pill kind={data?.ml?.calibrated_confidence ? "good" : "neutral"}>Confiance {data?.ml?.calibrated_confidence ? "calibrée" : "non calibrée"}</Pill>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(data?.agents ?? []).map((a: any) => (
          <Card key={a.name} title={TITLES[a.name] ?? a.name} right={<Pill kind={statusKind(a.status)}>{a.status}</Pill>}>
            <p className="text-xs text-muted">{a.role}</p>
            <div className="mt-3 rounded-xl bg-raised px-3 py-2 text-sm">{a.last_report?.summary ?? "—"}</div>
            <div className="mt-2 flex justify-between text-xs text-faint">
              <span>Dernière analyse : {ago(a.last_report?.timestamp ?? a.last_run_ms)}</span>
              <span>{a.errors?.length ?? 0} erreur(s)</span>
            </div>
            {a.errors?.length > 0 && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-bad">Erreurs récentes</summary>
                <ul className="mt-1 space-y-1 text-muted">{a.errors.slice(-5).map((e: any, i: number) => <li key={i}>{time(e.ts)} — {e.error}</li>)}</ul>
              </details>
            )}
            {a.history?.length > 0 && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-muted">Historique</summary>
                <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-muted">
                  {a.history.slice().reverse().slice(0, 15).map((h: any, i: number) => <li key={i}>{time(h.ts)} — {h.summary}</li>)}
                </ul>
              </details>
            )}
          </Card>
        ))}
      </div>
      <Card title="Historique des décisions">
        {data?.decisions?.length ? (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Heure</th><th>Décision</th><th>Stratégie</th><th>Régime</th><th>Score</th><th>Risque</th><th>Raisons</th></tr></thead>
              <tbody>
                {data.decisions.map((d: any, i: number) => (
                  <tr key={i}>
                    <td className="num whitespace-nowrap text-muted">{time(d.ts)}</td>
                    <td><Pill kind={d.direction === "LONG" ? "good" : d.direction === "SHORT" ? "bad" : "neutral"}>{d.direction.replace("_", " ")}</Pill></td>
                    <td>{strategyLabel[d.strategy] ?? d.strategy}</td>
                    <td className="text-muted">{regimeLabel[d.regime] ?? d.regime}</td>
                    <td className="num">{d.score === null ? "–" : Math.round(d.score)}</td>
                    <td>{d.score === null ? "–" : <Pill kind={d.approved ? "good" : "warn"}>{d.approved ? "approuvé" : "veto"}</Pill>}</td>
                    <td className="max-w-md text-xs text-muted">{(d.reasons ?? []).slice(0, 2).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucune décision enregistrée pour l'instant.</Empty>
        )}
      </Card>
    </div>
  );
}
