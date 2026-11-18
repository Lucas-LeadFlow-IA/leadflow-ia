"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { apiPost, getToken, setToken, usePoll } from "@/lib/api";
import { Pill, statusKind } from "@/components/ui";

const NAV = [
  { href: "/", label: "Vue d'ensemble", short: "Accueil", icon: "◧" },
  { href: "/market", label: "Marché", short: "Marché", icon: "◔" },
  { href: "/agents", label: "Agents", short: "Agents", icon: "◎" },
  { href: "/trades", label: "Trades", short: "Trades", icon: "⇅" },
  { href: "/risk", label: "Risque", short: "Risque", icon: "◈" },
  { href: "/settings", label: "Paramètres", short: "Réglages", icon: "⚙" },
];

const MODE_KIND: Record<string, string> = { paper: "info", testnet: "warn", live: "bad" };

function Login() {
  const [value, setValue] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        className="card w-full max-w-sm p-6"
        onSubmit={(e) => {
          e.preventDefault();
          setToken(value.trim());
        }}
      >
        <div className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <span className="text-accent">₿</span> BTC AI Trading
        </div>
        <p className="mb-5 text-sm text-muted">Entrez le jeton du dashboard (DASHBOARD_TOKEN ou runtime/dashboard_token.txt).</p>
        <label className="label" htmlFor="tok">Jeton</label>
        <input
          id="tok"
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-line bg-raised px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button className="btn-primary mt-4 w-full" disabled={!value.trim()}>Se connecter</button>
      </form>
    </div>
  );
}

function EmergencyButton() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <button className="btn-danger whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm" onClick={() => setOpen(true)} aria-label="Arrêt d'urgence">
        ■ <span className="sm:hidden">Urgence</span><span className="hidden sm:inline">Arrêt d'urgence</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal>
          <div className="card w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-bad">Arrêt d'urgence</h3>
            <p className="mt-2 text-sm text-muted">
              Bloque immédiatement toute nouvelle entrée, annule les ordres en attente et applique la procédure de gestion de la position
              ouverte (EMERGENCY_POSITION_POLICY). La réactivation exige une réinitialisation manuelle en ligne de commande.
            </p>
            <label className="label mt-4 block" htmlFor="em">Tapez EMERGENCY pour confirmer</label>
            <input id="em" value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1.5 w-full rounded-xl border border-line bg-raised px-3 py-2 text-sm outline-none focus:border-bad" />
            {msg && <p className="mt-2 text-sm text-warn">{msg}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => { setOpen(false); setTyped(""); setMsg(null); }}>Annuler</button>
              <button
                className="btn-danger"
                disabled={typed !== "EMERGENCY"}
                onClick={async () => {
                  try {
                    await apiPost("/api/control/emergency-stop", { confirm: "EMERGENCY" });
                    setMsg("Arrêt d'urgence exécuté.");
                    setTimeout(() => setOpen(false), 1200);
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Confirmer l'arrêt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TopBar() {
  const { data } = usePoll<any>("/api/health", 4000);
  const mode = data?.mode ?? "…";
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2.5">
          <span className="text-lg font-bold text-accent md:hidden">₿</span>
          <Pill kind={MODE_KIND[mode] ?? "neutral"}>{String(mode).toUpperCase()}</Pill>
          <Pill kind={statusKind(data?.kill_switch)}><span className="hidden sm:inline">Kill switch : </span>{data?.kill_switch ?? "…"}</Pill>
          <span className="hidden sm:inline">
            <Pill kind={data?.ws_connected ? "good" : "bad"}>{data?.ws_connected ? "Flux temps réel" : "Flux coupé"}</Pill>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <EmergencyButton />
          <button className="btn-ghost hidden px-3 py-1.5 text-xs sm:inline-flex" onClick={() => setToken(null)}>Déconnexion</button>
        </div>
      </div>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const path = usePathname();
  useEffect(() => {
    const check = () => setAuthed(Boolean(getToken()));
    check();
    window.addEventListener("auth-change", check);
    return () => window.removeEventListener("auth-change", check);
  }, []);
  if (authed === null) return null;
  if (!authed) return <Login />;
  const active = (href: string) => (href === "/" ? path === "/" : path?.startsWith(href));
  return (
    <div className="min-h-screen md:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface/60 px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-lg font-bold text-accent">₿</span>
          <div>
            <div className="text-sm font-semibold leading-tight">BTC AI Trading</div>
            <div className="text-[11px] text-muted">Hyperliquid · perps</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${active(n.href) ? "bg-raised text-ink" : "text-muted hover:bg-raised/60 hover:text-ink"}`}
            >
              <span aria-hidden className={active(n.href) ? "text-accent" : ""}>{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-2 text-[11px] leading-relaxed text-faint">
          Objectifs de gains = exploratoires, jamais garantis. Le Risk Manager a un droit de veto absolu.
        </p>
      </aside>
      <TopBar />
      <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 md:pb-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${active(n.href) ? "text-accent" : "text-muted"}`}>
            <span aria-hidden className="text-base leading-none">{n.icon}</span>
            {n.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
