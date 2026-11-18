"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const KEY = "btc_dash_token";

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(t: string | null) {
  try {
    if (t) window.localStorage.setItem(KEY, t);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: token lives for this page only */
  }
  window.dispatchEvent(new Event("auth-change"));
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (res.status === 401) {
    setToken(null);
    throw new ApiError(401, "Jeton invalide");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, String(detail));
  }
  return res.json() as Promise<T>;
}

export const apiGet = <T,>(path: string) => call<T>(path);
export const apiPost = <T,>(path: string, body?: unknown) =>
  call<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

/** Poll an endpoint every `intervalMs` (pauses when the tab is hidden). */
export function usePoll<T = any>(path: string | null, intervalMs = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<number | null>(null);
  const alive = useRef(true);
  const run = useCallback(async () => {
    if (!path || document.hidden) return;
    try {
      const d = await apiGet<T>(path);
      if (alive.current) {
        setData(d);
        setError(null);
        setUpdated(Date.now());
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    }
  }, [path]);
  useEffect(() => {
    alive.current = true;
    run();
    const id = setInterval(run, intervalMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [run, intervalMs]);
  return { data, error, updated, refresh: run };
}
