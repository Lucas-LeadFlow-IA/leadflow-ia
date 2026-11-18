"""Telegram bot (Bot API over HTTPS, long polling via getUpdates).

Implemented directly on the documented Bot API (https://core.telegram.org/bots/api)
with httpx to avoid a heavy dependency. The package is named `telegram` as
required by the project layout; do not install `python-telegram-bot` in the
same environment (name clash).

Security:
* only numeric user ids listed in TELEGRAM_ALLOWED_USER_IDS are served;
  everyone else is ignored (and logged),
* commands can read state, pause, resume (from PAUSED only) and trigger
  the emergency stop (two-step confirmation). There is deliberately NO
  command that changes risk limits, strategy parameters or the mode.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

log = logging.getLogger("telegram")

HELP = (
    "Commandes disponibles:\n"
    "/status – état du système\n/balance – capital et equity\n/positions – position et ordres\n"
    "/performance – statistiques\n/strategies – régime et stratégie active\n/risk – limites et état du risk manager\n"
    "/pause – suspendre les nouvelles entrées\n/resume – reprendre (si en pause)\n"
    "/emergency_stop – arrêt d'urgence (confirmation requise)\n\n"
    "Les limites de risque ne sont pas modifiables via Telegram."
)


class TelegramBot:
    API = "https://api.telegram.org"

    def __init__(self, token: str, allowed_user_ids: list[int], system=None, transport: httpx.AsyncBaseTransport | None = None):
        if not token:
            raise ValueError("telegram token missing")
        self.allowed = set(int(x) for x in allowed_user_ids)
        self.system = system
        self._client = httpx.AsyncClient(base_url=f"{self.API}/bot{token}", timeout=35.0, transport=transport)
        self._offset = 0
        self._pending_emergency: dict[int, float] = {}
        self._last_cmd: dict[int, float] = {}
        self._stop = asyncio.Event()

    # ------------------------------------------------------------------ transport
    async def _call(self, method: str, **params) -> Any:
        r = await self._client.post(f"/{method}", json=params)
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(f"telegram {method} failed: {data.get('description')}")
        return data["result"]

    async def send(self, chat_id: int, text: str) -> None:
        try:
            await self._call("sendMessage", chat_id=chat_id, text=text[:4000], disable_web_page_preview=True)
        except Exception as exc:  # noqa: BLE001
            log.warning("telegram send failed: %s", exc)

    async def notify(self, level: str, text: str) -> None:
        """Notifier interface used by the orchestrator."""
        prefix = {"critical": "🚨 ", "warning": "⚠️ "}.get(level, "")
        for uid in self.allowed:
            await self.send(uid, prefix + text)

    # ------------------------------------------------------------------ polling
    async def run(self) -> None:
        backoff = 1.0
        while not self._stop.is_set():
            try:
                updates = await self._call("getUpdates", offset=self._offset, timeout=25, allowed_updates=["message"])
                backoff = 1.0
                for u in updates:
                    self._offset = max(self._offset, int(u["update_id"]) + 1)
                    await self.handle_update(u)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                log.warning("telegram polling error: %s", exc)
                await asyncio.sleep(backoff)
                backoff = min(60.0, backoff * 2)

    async def stop(self) -> None:
        self._stop.set()
        await self._client.aclose()

    # ------------------------------------------------------------------ commands
    async def handle_update(self, update: dict) -> str | None:
        msg = update.get("message") or {}
        user = (msg.get("from") or {}).get("id")
        chat = (msg.get("chat") or {}).get("id")
        text = (msg.get("text") or "").strip()
        if user is None or chat is None or not text.startswith("/"):
            return None
        if int(user) not in self.allowed:
            log.warning("telegram command from unauthorized user id %s ignored", user)
            return None
        now = time.monotonic()
        if now - self._last_cmd.get(user, 0) < 1.0:
            return None
        self._last_cmd[user] = now
        parts = text.split()
        cmd = parts[0].split("@")[0].lower()
        args = parts[1:]
        reply = await self.execute(cmd, args, int(user))
        if reply:
            await self.send(chat, reply)
        return reply

    async def execute(self, cmd: str, args: list[str], user: int) -> str:
        s = self.system
        if cmd in ("/start", "/help"):
            return HELP
        if s is None:
            return "Système non démarré."
        st = s.state()
        acct, risk = st.get("account") or {}, st["risk"]
        if cmd == "/status":
            return (f"Mode: {st['mode'].upper()} | Kill switch: {risk['kill_switch']['state']}\n"
                    f"Régime: {st['regime']} | Stratégie active: {st['active_strategy']}\n"
                    f"WS connecté: {st['market_health']['ws_connected']} | Boucles: {st['loops']}\n"
                    f"Position: {'oui' if st['position'] else 'non'} | Dernière erreur: {st['last_error'] or '–'}")
        if cmd == "/balance":
            return (f"Equity: {acct.get('equity', 0):,.2f} USD\nSolde: {acct.get('balance', 0):,.2f} USD\n"
                    f"P&L jour: {risk['daily_pnl']:+.2f} USD | Drawdown: {risk['drawdown_pct']:.2f}%")
        if cmd == "/positions":
            p = st["position"]
            if not p:
                return "Aucune position ouverte."
            return (f"{p['direction']} {p['size']} BTC @ {p['entry_price']:,.1f}\nSL {p['stop_loss']:,.1f} | "
                    f"TP {p['take_profit'] or 0:,.1f}\nStratégie {p['strategy']} / régime {p['regime']}\n"
                    f"Risque initial {p['risk_usd']:.2f} USD")
        if cmd == "/performance":
            return s.performance.daily_report_text(risk)
        if cmd == "/strategies":
            sig = st.get("last_signal") or {}
            return (f"Régime: {st['regime']}\nStratégie active: {st['active_strategy']}\n"
                    f"Dernière décision: {sig.get('direction', '–')} {sig.get('strategy', '')}\n{sig.get('strategy_rationale', '')}")
        if cmd == "/risk":
            L = risk["limits"]
            return (f"Risque/trade: {L['risk_per_trade_pct']}% ({risk['risk_per_trade_usd']:.2f} USD)\n"
                    f"Perte jour max: {L['max_daily_loss_pct']}% | actuelle {risk['daily_loss_pct']:.2f}%\n"
                    f"Drawdown max: {L['max_drawdown_pct']}% | actuel {risk['drawdown_pct']:.2f}%\n"
                    f"Levier max: {L['max_leverage']}x | Positions max: {L['max_open_positions']}\n"
                    f"Pertes consécutives: {risk['consecutive_losses']} | Verrou jour: {risk['daily_locked']}\n"
                    "(lecture seule — non modifiable via Telegram)")
        if cmd == "/pause":
            await s.pause("telegram")
            return "⏸ Nouvelles entrées suspendues. Les positions restent protégées."
        if cmd == "/resume":
            try:
                await s.resume("telegram")
                return "▶️ Entrées réactivées."
            except Exception as exc:  # noqa: BLE001
                return f"Refusé: {exc}"
        if cmd == "/emergency_stop":
            if args and args[0].upper() == "CONFIRM" and time.monotonic() - self._pending_emergency.get(user, 0) <= 60:
                self._pending_emergency.pop(user, None)
                await s.emergency_stop("telegram")
                return "🛑 ARRÊT D'URGENCE exécuté: entrées bloquées, ordres annulés, procédure de position appliquée."
            self._pending_emergency[user] = time.monotonic()
            return "Confirmer l'arrêt d'urgence: envoyez « /emergency_stop CONFIRM » dans les 60 secondes."
        return "Commande inconnue. /help"
