"use client";

import { usePoll } from "@/lib/api";
import { num, regimeLabel, signedUsd, strategyLabel, time, tone, usd } from "@/lib/format";
import { Card, Empty, ErrorNote, KV, Pill } from "@/components/ui";

export default function Trades() {
  const { data, error } = usePoll<any>("/api/trades", 5000);
  const pos = data?.open_position;
  const exPos = data?.account_positions?.[0];
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Trades</h1>
      <ErrorNote error={error} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Position ouverte (gérée)">
          {pos ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Pill kind={pos.direction === "LONG" ? "good" : "bad"}>{pos.direction}</Pill>
                <span className="num text-sm">{pos.size} BTC</span>
              </div>
              <KV k="Entrée" v={usd(pos.entry_price, 1)} />
              <KV k="Stop-loss actuel / initial" v={`${usd(pos.stop_loss, 0)} / ${usd(pos.initial_stop, 0)}`} />
              <KV k="Take-profit" v={usd(pos.take_profit, 0)} />
              <KV k="Risque initial" v={usd(pos.risk_usd)} />
              <KV k="Frais d'entrée" v={usd(pos.entry_fee, 4)} />
              <KV k="Durée max" v={`${pos.max_hold_minutes} min`} />
            </div>
          ) : (
            <Empty>Aucune position gérée.</Empty>
          )}
        </Card>
        <Card title="Position côté exchange (source de vérité)">
          {exPos ? (
            <div>
              <KV k="Taille" v={`${exPos.size} BTC`} />
              <KV k="Prix d'entrée" v={usd(exPos.entry_price, 1)} />
              <KV k="P&L latent" v={<span className={tone(exPos.unrealized_pnl)}>{signedUsd(exPos.unrealized_pnl)}</span>} />
              <KV k="Levier / marge" v={`${exPos.leverage}x ${exPos.margin_mode}`} />
              <KV k="Prix de liquidation" v={usd(exPos.liquidation_price, 0)} />
            </div>
          ) : (
            <Empty>Compte à plat.</Empty>
          )}
        </Card>
        <Card title="Ordres ouverts">
          {data?.open_orders?.length ? (
            <ul className="space-y-2 text-sm">
              {data.open_orders.map((o: any) => (
                <li key={o.oid} className="flex items-center justify-between rounded-xl bg-raised px-3 py-2">
                  <span>{o.order_type || (o.is_trigger ? "Trigger" : "Limit")} {o.is_buy ? "achat" : "vente"} {o.reduce_only ? "· reduce-only" : ""}</span>
                  <span className="num text-muted">{o.size} @ {usd(o.trigger_price ?? o.limit_price, 0)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucun ordre ouvert.</Empty>
          )}
        </Card>
      </div>

      <Card title="Historique des trades">
        {data?.trades?.length ? (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Sortie</th><th>Sens</th><th>Stratégie</th><th>Régime</th><th>Entrée</th><th>Sortie</th><th>SL init.</th><th>TP</th><th>Taille</th><th>Frais</th><th>Funding</th><th>P&L net</th><th>R</th><th>Motif</th></tr>
              </thead>
              <tbody>
                {data.trades.map((t: any, i: number) => (
                  <tr key={i}>
                    <td className="num whitespace-nowrap text-muted">{time(t.exit_time)}</td>
                    <td><Pill kind={t.direction === "LONG" ? "good" : "bad"}>{t.direction}</Pill></td>
                    <td>{strategyLabel[t.strategy] ?? t.strategy}</td>
                    <td className="text-muted">{regimeLabel[t.regime] ?? t.regime}</td>
                    <td className="num">{usd(t.entry_price, 0)}</td>
                    <td className="num">{usd(t.exit_price, 0)}</td>
                    <td className="num">{usd(t.initial_stop, 0)}</td>
                    <td className="num">{usd(t.take_profit, 0)}</td>
                    <td className="num">{t.size}</td>
                    <td className="num">{usd(t.fees, 3)}</td>
                    <td className="num">{usd(t.funding, 3)}</td>
                    <td className={`num font-medium ${tone(t.net_pnl)}`}>{signedUsd(t.net_pnl)}</td>
                    <td className="num">{num(t.r_multiple, 2)}</td>
                    <td className="max-w-xs text-xs text-muted">{t.exit_reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucun trade clôturé dans ce mode.</Empty>
        )}
      </Card>

      <Card title="Journal des ordres">
        {data?.orders?.length ? (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Heure</th><th>Type</th><th>Côté</th><th>Taille</th><th>Prix</th><th>Trigger</th><th>État</th><th>Erreur</th></tr></thead>
              <tbody>
                {data.orders.map((o: any, i: number) => (
                  <tr key={i}>
                    <td className="num whitespace-nowrap text-muted">{time(o.ts)}</td>
                    <td>{o.kind}</td><td>{o.side}</td><td className="num">{o.size}</td><td className="num">{usd(o.price, 0)}</td>
                    <td className="num">{o.trigger ? usd(o.trigger, 0) : "–"}</td>
                    <td><Pill kind={o.error ? "bad" : "neutral"}>{o.state ?? "–"}</Pill></td>
                    <td className="max-w-xs text-xs text-bad">{o.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucun ordre envoyé.</Empty>
        )}
      </Card>
    </div>
  );
}
