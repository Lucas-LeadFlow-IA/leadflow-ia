import type { ReactNode } from "react";

export function Card({ title, right, children, className = "" }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title ? <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2> : <span />}
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, valueClass = "" }: { label: string; value: ReactNode; sub?: ReactNode; valueClass?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`num mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl ${valueClass}`}>{value}</div>
      {sub ? <div className="num mt-1 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

const PILL: Record<string, string> = {
  good: "border-good/40 bg-good/10 text-good",
  warn: "border-warn/40 bg-warn/10 text-warn",
  bad: "border-bad/50 bg-bad/10 text-bad",
  info: "border-info/40 bg-info/10 text-info",
  neutral: "border-line bg-raised text-muted",
  accent: "border-accent/40 bg-accent/10 text-accent",
};
const ICON: Record<string, string> = { good: "●", warn: "▲", bad: "■", info: "◆", neutral: "○", accent: "◆" };

/** Status pill: colour is always paired with an icon + text label. */
export function Pill({ kind = "neutral", children }: { kind?: keyof typeof PILL | string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL[kind] ?? PILL.neutral}`}>
      <span aria-hidden className="text-[9px]">{ICON[kind] ?? "○"}</span>
      {children}
    </span>
  );
}

export function statusKind(s: string | undefined | null): string {
  switch (s) {
    case "ok":
    case "running":
    case "approved":
      return "good";
    case "warning":
    case "paused":
      return "warn";
    case "error":
    case "halted":
      return "bad";
    case "idle":
      return "neutral";
    default:
      return "neutral";
  }
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</div>;
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const kind = ratio >= 0.9 ? "bg-bad" : ratio >= 0.6 ? "bg-warn" : "bg-good";
  return (
    <div>
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="num text-ink">
          {value.toFixed(2)} / {max.toFixed(2)}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raised" role="meter" aria-valuenow={value} aria-valuemax={max} aria-label={label}>
        <div className={`h-full rounded-full ${kind}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-line py-2 text-sm first:border-t-0">
      <span className="text-muted">{k}</span>
      <span className="num text-right text-ink">{v}</span>
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">⚠ {error}</div>;
}
