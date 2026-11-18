"""Price / size rounding following Hyperliquid tick & lot rules.

Docs (for-developers/api/tick-and-lot-size):
* prices: up to 5 significant figures, and no more than
  MAX_DECIMALS - szDecimals decimals (MAX_DECIMALS = 6 for perps);
  integer prices are always allowed.
* sizes: rounded to szDecimals.
"""
from __future__ import annotations

import math
import secrets
from decimal import ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_EVEN, Decimal

PERP_MAX_DECIMALS = 6


def price_decimals(px: float, sz_decimals: int, max_decimals: int = PERP_MAX_DECIMALS) -> int:
    if px <= 0:
        raise ValueError("price must be positive")
    int_digits = int(math.floor(math.log10(px))) + 1
    sig_dec = 5 - int_digits
    return max(0, min(max_decimals - sz_decimals, sig_dec))


def round_price(px: float, sz_decimals: int, mode: str = "nearest") -> float:
    """mode: 'nearest' | 'down' | 'up' (use down/up to stay on the safe side)."""
    dec = price_decimals(px, sz_decimals)
    q = Decimal(1).scaleb(-dec)
    rounding = {"nearest": ROUND_HALF_EVEN, "down": ROUND_FLOOR, "up": ROUND_CEILING}[mode]
    out = float(Decimal(str(px)).quantize(q, rounding=rounding))
    # rounding up/down can change the integer digit count (e.g. 9999.95 -> 10000); re-check
    if price_decimals(out, sz_decimals) < dec:
        out = float(Decimal(str(out)).quantize(Decimal(1).scaleb(-price_decimals(out, sz_decimals)), rounding=rounding))
    return out


def round_size(sz: float, sz_decimals: int) -> float:
    q = Decimal(1).scaleb(-sz_decimals)
    return float(Decimal(str(abs(sz))).quantize(q, rounding=ROUND_FLOOR))


def is_valid_price(px: float, sz_decimals: int) -> bool:
    return round_price(px, sz_decimals) == px


def new_cloid() -> str:
    """128-bit client order id as required by the API: '0x' + 32 hex chars."""
    return "0x" + secrets.token_hex(16)
